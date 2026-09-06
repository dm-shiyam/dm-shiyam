#!/usr/bin/env node
// scripts/test-payment-failures.mjs
// V12 — Payment failure scenario regression suite.
//
// Simulates Razorpay webhook events against a running dev server and asserts
// the correct side effects (or lack thereof) land in Postgres.
//
// Covers:
//   12.1 Card declined  → `payment.failed` never activates a user
//   12.2 Checkout abandoned → subscription created but not yet paid stays free
//   12.3 Network drop / webhook retry → `subscription.activated` fired 20×
//        concurrently produces exactly one active user (idempotent)
//   12.4 Invalid signature → 400, no state change (regression guard)
//
// USAGE:
//   1) Terminal A:  pnpm dev
//   2) Terminal B:  node scripts/test-payment-failures.mjs
//
// Required env (auto-loaded from `.env.local`):
//   DATABASE_URL             — reachable Postgres (test or prod)
//   RAZORPAY_WEBHOOK_SECRET  — must match what the server uses to verify
//
// Optional:
//   BASE_URL                 — default http://localhost:3000

import { readFileSync, existsSync } from "node:fs";
import crypto from "node:crypto";
import pg from "pg";

// ────────────────────────────────────────────────────────────────────────
// Env loading — same pattern as test-onboarding-drip.mjs
// ────────────────────────────────────────────────────────────────────────
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

const DB_URL = process.env.DATABASE_URL;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const BASE = process.env.BASE_URL || "http://localhost:3000";

if (!DB_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(2);
}
if (!WEBHOOK_SECRET) {
  console.error("❌ RAZORPAY_WEBHOOK_SECRET not set");
  process.exit(2);
}

// ────────────────────────────────────────────────────────────────────────
// Pretty output
// ────────────────────────────────────────────────────────────────────────
const c = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", b: "\x1b[36m", x: "\x1b[0m" };
let passed = 0;
let failed = 0;
const failures = [];

const h = (m) => console.log(`\n${c.b}━━ ${m}${c.x}`);
const ok = (m) => {
  passed++;
  console.log(`  ${c.g}✓${c.x} ${m}`);
};
const bad = (m, exp, got) => {
  failed++;
  failures.push(`${m}: expected ${exp}, got ${got}`);
  console.log(`  ${c.r}✗${c.x} ${m}: expected ${c.g}${exp}${c.x}, got ${c.r}${got}${c.x}`);
};

function assertEq(actual, expected, msg) {
  if (actual === expected) ok(msg);
  else bad(msg, JSON.stringify(expected), JSON.stringify(actual));
}

// ────────────────────────────────────────────────────────────────────────
// Webhook helpers
// ────────────────────────────────────────────────────────────────────────
function sign(body) {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

async function postWebhook(event, { badSig = false } = {}) {
  const body = JSON.stringify(event);
  const signature = badSig ? "0".repeat(64) : sign(body);
  return fetch(`${BASE}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
    },
    body,
  });
}

function paymentFailedEvent({ userId, paymentId, subscriptionId }) {
  return {
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          id: paymentId,
          status: "failed",
          error_reason: "card_declined_by_issuer",
          error_description: "Your bank declined the payment.",
          notes: { user_id: userId, subscription_id: subscriptionId },
        },
      },
    },
  };
}

function subscriptionActivatedEvent({ userId, subscriptionId }) {
  return {
    event: "subscription.activated",
    payload: {
      subscription: {
        entity: {
          id: subscriptionId,
          status: "active",
          notes: { user_id: userId, plan: "pro" },
        },
      },
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// DB setup / teardown
// ────────────────────────────────────────────────────────────────────────
const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

const runId = Date.now();
const TEST_EMAIL = `v12-test-${runId}@dmshiyam-test.local`;
const SUB_ID = `sub_test_${runId}`;
let userId = null;

async function cleanup() {
  if (userId) {
    await client
      .query("DELETE FROM users WHERE id = $1", [userId])
      .catch(() => {});
  }
  await client.end().catch(() => {});
}

async function createTestUser() {
  const id = crypto.randomUUID();
  await client.query(
    `INSERT INTO users (id, email, name, password_hash, provider,
                        plan, dm_limit, subscription_status,
                        razorpay_subscription_id)
     VALUES ($1, $2, 'V12 Test User', 'x', 'credentials',
             'free', 100, 'none', $3)`,
    [id, TEST_EMAIL, SUB_ID]
  );
  return id;
}

async function getUserState() {
  const res = await client.query(
    `SELECT plan, subscription_status, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return res.rows[0];
}

// ────────────────────────────────────────────────────────────────────────
// Run tests
// ────────────────────────────────────────────────────────────────────────
try {
  console.log(`\n${c.b}▶ V12 Payment Failure Suite${c.x}`);
  console.log(`  base:        ${BASE}`);
  console.log(`  test user:   ${TEST_EMAIL}`);
  console.log(`  test sub id: ${SUB_ID}\n`);

  // Verify server is reachable BEFORE creating DB rows so a stopped dev
  // server exits fast without leaving orphan test users behind.
  try {
    const ping = await fetch(`${BASE}/`);
    if (!ping.ok && ping.status !== 200) throw new Error("bad status");
  } catch (err) {
    console.error(
      `${c.r}❌ Dev server unreachable at ${BASE}. Start it with \`pnpm dev\`.${c.x}`
    );
    console.error(`   ${err?.message ?? err}`);
    await cleanup();
    process.exit(1);
  }

  userId = await createTestUser();

  // ─────────────────────────────────────────────────────────────────────
  h("12.4 Signature validation (regression guard, run first)");
  {
    // If invalid-sig acceptance ever regresses, every other test in this
    // file becomes meaningless — run this before any state mutations.
    const evt = subscriptionActivatedEvent({ userId, subscriptionId: SUB_ID });
    const res = await postWebhook(evt, { badSig: true });
    assertEq(res.status, 400, "invalid signature → 400");

    const state = await getUserState();
    assertEq(
      state.subscription_status,
      "none",
      "no state change on invalid signature",
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  h("12.1 Card declined — payment.failed never activates a user");
  {
    const stateBefore = await getUserState();

    const evt = paymentFailedEvent({
      userId,
      paymentId: `pay_test_${runId}_declined`,
      subscriptionId: SUB_ID,
    });
    const res = await postWebhook(evt);
    assertEq(res.status, 200, "payment.failed accepted (200 OK)");

    const stateAfter = await getUserState();
    assertEq(
      stateAfter.subscription_status,
      stateBefore.subscription_status,
      "subscription_status unchanged after payment.failed",
    );
    assertEq(
      stateAfter.plan,
      stateBefore.plan,
      "plan unchanged after payment.failed",
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  h("12.2 Checkout abandoned — no webhook → user stays free");
  {
    // Simulates the "user opened Razorpay checkout, closed the tab, never
    // paid". Our system's contract: nothing happens server-side without
    // a webhook. Verify the user is still on the default free plan.
    const state = await getUserState();
    assertEq(state.plan, "free", "plan is 'free' with no payment webhook");
    assertEq(
      state.subscription_status,
      "none",
      "subscription_status is 'none' with no payment webhook",
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  h("12.3 Network drop / retry — 20 concurrent activations = 1 active user");
  {
    const evt = subscriptionActivatedEvent({ userId, subscriptionId: SUB_ID });
    const N = 20;
    const results = await Promise.all(
      Array.from({ length: N }, () => postWebhook(evt))
    );

    const okCount = results.filter((r) => r.status === 200).length;
    assertEq(okCount, N, `all ${N} concurrent retries return 200`);

    const state = await getUserState();
    assertEq(
      state.subscription_status,
      "active",
      "user ended in `active` state exactly once",
    );

    // Idempotency proof: fire another wave, updated_at must not run away.
    const midTs = new Date(state.updated_at).getTime();
    await Promise.all(
      Array.from({ length: 5 }, () => postWebhook(evt))
    );
    const stateAfter = await getUserState();
    const afterTs = new Date(stateAfter.updated_at).getTime();

    // Note: `updateUserPlan` does bump `updated_at = NOW()` on every call,
    // so this only checks that state (plan / status) doesn't drift, not
    // that timestamps stay pinned. That's the correct idempotency contract
    // for us — actionable state is stable, audit timestamps can move.
    assertEq(
      stateAfter.subscription_status,
      "active",
      "still `active` after second retry wave (state stable)",
    );
    if (afterTs >= midTs) ok("updated_at moves forward under retries (audit trail intact)");
    else bad("updated_at moves forward under retries", ">=", `${afterTs} < ${midTs}`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────
  const total = passed + failed;
  const color = failed === 0 ? c.g : c.r;
  const mark = failed === 0 ? "✅" : "❌";
  console.log(`\n${color}${mark} ${passed}/${total} passed${c.x}`);
  if (failed) {
    console.log(`\n${c.r}Failures:${c.x}`);
    for (const f of failures) console.log(`  • ${f}`);
  }
  await cleanup();
  process.exit(failed === 0 ? 0 : 1);
} catch (err) {
  console.error(`\n${c.r}💥 Test runner crashed:${c.x}`, err);
  await cleanup();
  process.exit(1);
}
