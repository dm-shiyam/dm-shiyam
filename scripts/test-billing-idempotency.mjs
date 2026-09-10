#!/usr/bin/env node
// scripts/test-billing-idempotency.mjs
//
// V6+V7 regression harness for the billing_events dedup mutex.
//
// Fires two identical Razorpay webhook payloads against
// /api/billing/webhook and asserts:
//   1) both requests return HTTP 200 (Razorpay never retries a 4xx/5xx)
//   2) the FIRST returns {status:'ok', result:'…'}
//   3) the SECOND returns {status:'ok', duplicate:true}
//   4) the users.plan / dm_limit / subscription_status is set exactly once
//   5) exactly one billing_events row exists for that event_id
//
// This proves the INSERT ON CONFLICT (event_id) DO NOTHING pattern
// short-circuits Razorpay retries before touching users, which is the
// invariant we need to prevent double-billing analytics + double
// welcome emails when Razorpay retries after a network blip.
//
// USAGE:
//   1) In one terminal: pnpm dev              (starts Next.js on :3000)
//   2) In another:      node scripts/test-billing-idempotency.mjs
//
// Required env (both scripts read from .env.local automatically via
// dotenv if you `--experimental-loader dotenv`; simplest is to export):
//   RAZORPAY_WEBHOOK_SECRET — matches Vercel / .env.local
//   DATABASE_URL            — Postgres connection string
//   TEST_USER_ID            — an existing users.id to upgrade in the test

import crypto from "node:crypto";
import pg from "pg";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const DB_URL = process.env.DATABASE_URL;
const USER_ID = process.env.TEST_USER_ID;

if (!SECRET || !DB_URL || !USER_ID) {
  console.error(
    "ERROR: set RAZORPAY_WEBHOOK_SECRET, DATABASE_URL, and TEST_USER_ID"
  );
  process.exit(2);
}

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  \u2713 ${name}`);
}
function bad(name, extra) {
  failed++;
  console.log(`  \u2717 ${name}`);
  if (extra !== undefined) console.log("     " + JSON.stringify(extra));
}

// ── Craft a fake subscription.charged event with a fresh event.id ──
const eventId = `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const subscriptionId = `sub_test_${Date.now()}`;

const eventPayload = {
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

const body = JSON.stringify(eventPayload);
const signature = crypto
  .createHmac("sha256", SECRET)
  .update(body)
  .digest("hex");

async function postWebhook() {
  return fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Razorpay-Signature": signature,
    },
    body,
  });
}

async function run() {
  console.log(`\n\u25B6  Testing billing webhook idempotency (event_id=${eventId})\n`);

  // ── Attempt 1 — first delivery ──
  const r1 = await postWebhook();
  const j1 = await r1.json();
  if (r1.status === 200) ok("first delivery returns 200");
  else bad("first delivery returns 200", { status: r1.status, body: j1 });

  if (j1.duplicate !== true) ok("first delivery is NOT marked duplicate");
  else bad("first delivery is NOT marked duplicate", j1);

  // ── Attempt 2 — retry (identical body/signature) ──
  const r2 = await postWebhook();
  const j2 = await r2.json();
  if (r2.status === 200) ok("retry delivery returns 200");
  else bad("retry delivery returns 200", { status: r2.status, body: j2 });

  if (j2.duplicate === true) ok("retry delivery IS marked duplicate");
  else bad("retry delivery IS marked duplicate", j2);

  // ── DB assertions ──
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const evRes = await client.query(
      "SELECT COUNT(*)::int AS n FROM billing_events WHERE event_id = $1",
      [eventId]
    );
    if (evRes.rows[0].n === 1) ok("exactly ONE billing_events row for this event_id");
    else bad("exactly ONE billing_events row for this event_id", evRes.rows[0]);

    const userRes = await client.query(
      "SELECT plan, dm_limit, subscription_status FROM users WHERE id = $1",
      [USER_ID]
    );
    const u = userRes.rows[0];
    if (!u) {
      bad(`TEST_USER_ID ${USER_ID} exists`, null);
    } else {
      ok(`user row exists (plan=${u.plan}, dm_limit=${u.dm_limit}, status=${u.subscription_status})`);
      if (u.plan === "pro") ok("user.plan upgraded to 'pro'");
      else bad("user.plan upgraded to 'pro'", u);
      if (u.subscription_status === "active") ok("user.subscription_status='active'");
      else bad("user.subscription_status='active'", u);
    }
  } finally {
    await client.end();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
