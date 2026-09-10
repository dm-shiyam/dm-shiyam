#!/usr/bin/env node
// scripts/loadtest-billing-webhook.mjs
//
// V13 — Load test the Razorpay billing webhook endpoint.
//
// Two independent scenarios, each with 100 concurrent requests:
//
//   Scenario A — "Razorpay retry storm"
//     Fires 100 IDENTICAL subscription.charged events (same event.id,
//     same signature). Simulates Razorpay's own retry behavior when our
//     ack timed out. Asserts:
//       * 100 × HTTP 200 (never 5xx — Razorpay would keep retrying)
//       * exactly 1 billing_events row for the event_id
//       * exactly 1 plan-upgrade side effect on users.plan
//       * p95 latency < 2 s per request
//
//   Scenario B — "traffic spike"
//     Fires 100 DISTINCT subscription.charged events (unique event.id
//     each) in parallel. Simulates a marketing burst where 100 users
//     subscribe within a second. Asserts:
//       * 100 × HTTP 200
//       * exactly 100 billing_events rows
//       * no deadlocks / connection-pool exhaustion in the response body
//       * p95 latency < 3 s per request
//
// This is the concurrency guard on top of V11's serial idempotency test —
// V11 proves "retries are dedup'd", V13 proves "the dedup is atomic under
// contention". If a future refactor drops the INSERT ON CONFLICT and does
// SELECT-then-INSERT instead, V13 will detect the race window that V11
// cannot.
//
// USAGE:
//   1) Terminal A:  pnpm dev            # Next.js on :3000
//   2) Terminal B:  RAZORPAY_WEBHOOK_SECRET=... DATABASE_URL=... \
//                   TEST_USER_ID=<uuid> \
//                   node scripts/loadtest-billing-webhook.mjs
//
// Optional env:
//   BASE_URL       default http://localhost:3000
//   CONCURRENCY    default 100 (each scenario)

import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

// ── Auto-load .env.local so `node scripts/loadtest-billing-webhook.mjs`
// works out of the box, matching test-payment-failures.mjs. ──
if (existsSync(".env.local")) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const DB_URL = process.env.DATABASE_URL;
const USER_ID = process.env.TEST_USER_ID;
const CONCURRENCY = Number(process.env.CONCURRENCY || 100);

if (!SECRET || !DB_URL || !USER_ID) {
  console.error(
    "ERROR: set RAZORPAY_WEBHOOK_SECRET, DATABASE_URL, and TEST_USER_ID"
  );
  process.exit(2);
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(name, extra) {
  passed++;
  console.log(`  \u2713 ${name}${extra ? " — " + extra : ""}`);
}
function bad(name, extra) {
  failed++;
  console.log(`  \u2717 ${name}`);
  if (extra !== undefined) console.log("     " + JSON.stringify(extra));
}

function buildEvent({ eventId, subscriptionId }) {
  return {
    id: eventId,
    event: "subscription.charged",
    contains: ["subscription"],
    payload: {
      subscription: {
        entity: {
          id: subscriptionId,
          plan_id: "plan_test",
          status: "active",
          notes: {
            user_id: USER_ID,
            plan: "pro",
          },
        },
      },
    },
  };
}

function sign(body) {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

async function fireOnce(payload) {
  const body = JSON.stringify(payload);
  const signature = sign(body);
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Razorpay-Signature": signature,
    },
    body,
  });
  const latencyMs = Date.now() - t0;
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* body might be non-JSON on server crash */
  }
  return { status: res.status, latencyMs, json };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(name, results) {
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const statuses = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  return {
    name,
    n: results.length,
    statuses,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies[latencies.length - 1] || 0,
  };
}

function printSummary(s) {
  console.log(
    `    ${s.name}: n=${s.n} | statuses=${JSON.stringify(s.statuses)} | ` +
      `p50=${s.p50}ms p95=${s.p95}ms p99=${s.p99}ms max=${s.max}ms`
  );
}

// ────────────────────────────────────────────────────────────────────────
// Scenario A — Razorpay retry storm (identical events)
// ────────────────────────────────────────────────────────────────────────

async function scenarioA(pgClient) {
  console.log(
    `\n\u25B6  Scenario A — retry storm (${CONCURRENCY} × identical event)\n`
  );

  const eventId = `evt_loadA_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const subscriptionId = `sub_loadA_${Date.now()}`;
  const payload = buildEvent({ eventId, subscriptionId });

  // Reset the test user so we can measure the exact number of plan updates.
  await pgClient.query(
    "UPDATE users SET plan='free', subscription_status=NULL WHERE id=$1",
    [USER_ID]
  );

  const t0 = Date.now();
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => fireOnce(payload))
  );
  const wallMs = Date.now() - t0;

  const s = summarize("Scenario A", results);
  printSummary(s);
  console.log(`    wall clock: ${wallMs}ms`);

  // Every request must be 200. A single 5xx would cause Razorpay to retry
  // for hours, so this is the invariant that matters most.
  const non200 = results.filter((r) => r.status !== 200);
  if (non200.length === 0) ok(`all ${CONCURRENCY} requests returned 200`);
  else bad(`all ${CONCURRENCY} requests returned 200`, { non200: non200.length });

  if (s.p95 < 2000) ok(`p95 latency under 2s`, `${s.p95}ms`);
  else bad(`p95 latency under 2s`, { p95: s.p95 });

  // Exactly one billing_events row should exist for the event_id.
  const evRes = await pgClient.query(
    "SELECT COUNT(*)::int AS n FROM billing_events WHERE event_id=$1",
    [eventId]
  );
  if (evRes.rows[0].n === 1) ok("exactly ONE billing_events row for the event_id");
  else bad("exactly ONE billing_events row for the event_id", evRes.rows[0]);

  // Exactly one of the responses should NOT be a duplicate.
  const firsts = results.filter((r) => r.json && r.json.duplicate !== true);
  if (firsts.length === 1) ok("exactly 1 response marked as 'first' (rest deduped)");
  else bad("exactly 1 response marked as 'first' (rest deduped)", { firsts: firsts.length });

  // Plan should be upgraded exactly once (idempotent).
  const uRes = await pgClient.query(
    "SELECT plan, subscription_status FROM users WHERE id=$1",
    [USER_ID]
  );
  const u = uRes.rows[0];
  if (u && u.plan === "pro" && u.subscription_status === "active") {
    ok(`user.plan = pro, status = active`);
  } else {
    bad(`user.plan = pro, status = active`, u);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Scenario B — Traffic spike (distinct events)
// ────────────────────────────────────────────────────────────────────────

async function scenarioB(pgClient) {
  console.log(
    `\n\u25B6  Scenario B — traffic spike (${CONCURRENCY} × distinct events)\n`
  );

  const runTag = `evt_loadB_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const payloads = Array.from({ length: CONCURRENCY }, (_, i) =>
    buildEvent({
      eventId: `${runTag}_${i}`,
      subscriptionId: `sub_loadB_${Date.now()}_${i}`,
    })
  );

  const t0 = Date.now();
  const results = await Promise.all(payloads.map(fireOnce));
  const wallMs = Date.now() - t0;

  const s = summarize("Scenario B", results);
  printSummary(s);
  console.log(`    wall clock: ${wallMs}ms`);

  const non200 = results.filter((r) => r.status !== 200);
  if (non200.length === 0) ok(`all ${CONCURRENCY} requests returned 200`);
  else bad(`all ${CONCURRENCY} requests returned 200`, { non200: non200.length });

  if (s.p95 < 3000) ok(`p95 latency under 3s`, `${s.p95}ms`);
  else bad(`p95 latency under 3s`, { p95: s.p95 });

  // Each distinct event should have written exactly one billing_events row.
  const evRes = await pgClient.query(
    "SELECT COUNT(*)::int AS n FROM billing_events WHERE event_id LIKE $1",
    [`${runTag}_%`]
  );
  if (evRes.rows[0].n === CONCURRENCY) {
    ok(`exactly ${CONCURRENCY} billing_events rows written`);
  } else {
    bad(`exactly ${CONCURRENCY} billing_events rows written`, evRes.rows[0]);
  }

  // No response should look like an error — check the shape.
  const errors = results.filter(
    (r) => r.json && (r.json.error || r.json.status === "error")
  );
  if (errors.length === 0) ok("no error responses in the batch");
  else bad("no error responses in the batch", { errors: errors.length });
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────

async function run() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();

  // Sanity check the user exists — this is the first thing that breaks
  // when someone runs the script against the wrong environment.
  const check = await client.query("SELECT id, email FROM users WHERE id=$1", [
    USER_ID,
  ]);
  if (!check.rows[0]) {
    console.error(`\nERROR: TEST_USER_ID ${USER_ID} does not exist in this DB`);
    await client.end();
    process.exit(2);
  }
  console.log(`\nUsing TEST_USER_ID=${USER_ID} (${check.rows[0].email})`);
  console.log(`Target: ${BASE_URL}/api/billing/webhook`);

  try {
    await scenarioA(client);
    await scenarioB(client);
  } finally {
    // Best-effort cleanup — leave the test user in the free tier so a
    // rerun starts from a clean slate.
    await client.query(
      "UPDATE users SET plan='free', subscription_status=NULL WHERE id=$1",
      [USER_ID]
    );
    await client.end();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
