#!/usr/bin/env node
// scripts/test-reconcile-payments.mjs
// V11 regression harness for /api/cron/reconcile-payments.
//
// Runs the cron endpoint against a running Next.js dev server (`pnpm dev`
// on :3000). Uses HTTP so we exercise the full route handler + auth path.
//
// USAGE:
//   1) In one terminal:  pnpm dev
//   2) In another:       node scripts/test-reconcile-payments.mjs
//
// Optional env:
//   BASE_URL    — override target host (default: http://localhost:3000)
//   CRON_SECRET — required, must match server-side value
//
// This is a smoke test. It asserts wiring, not payment correctness — the
// live Razorpay ↔ Postgres comparison can only be validated once V10
// (Razorpay live keys) is done and real payments exist.

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const ENDPOINT = `${BASE_URL}/api/cron/reconcile-payments`;

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, reason) {
  failed++;
  console.log(`  ✗ ${name}`);
  console.log(`      ${reason}`);
}

async function assertEq(actual, expected, name) {
  if (actual === expected) return ok(name);
  fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function main() {
  console.log(`\n▶ Testing ${ENDPOINT}\n`);

  if (!CRON_SECRET) {
    console.error(
      "❌ CRON_SECRET env var not set. Copy it from Vercel or your .env and re-run:"
    );
    console.error("    CRON_SECRET=... node scripts/test-reconcile-payments.mjs");
    process.exit(2);
  }

  // -------------------------------------------------------------------------
  console.log("1) Auth");
  {
    const res = await fetch(ENDPOINT, { method: "POST" });
    await assertEq(res.status, 401, "POST without secret → 401");
  }
  {
    const res = await fetch(ENDPOINT + "?secret=nope", { method: "POST" });
    await assertEq(res.status, 401, "POST with wrong secret → 401");
  }
  {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });
    await assertEq(res.status, 401, "POST with wrong Bearer → 401");
  }

  // -------------------------------------------------------------------------
  console.log("\n2) Endpoint reachability with valid secret");
  const res = await fetch(ENDPOINT + `?secret=${encodeURIComponent(CRON_SECRET)}`, {
    method: "POST",
  });

  // Two acceptable outcomes:
  //  a) 200 — Razorpay keys are configured, reconciliation completed
  //  b) 503 — Razorpay keys missing (expected in dev), returns explicit error
  if (res.status === 200) {
    const body = await res.json();
    ok("200 response with reconciliation summary");
    const requiredKeys = ["success", "startedAt", "finishedAt", "totals", "mismatches"];
    for (const k of requiredKeys) {
      if (k in body) ok(`response has \`${k}\``);
      else fail(`response has \`${k}\``, `missing key ${k}`);
    }
    const tKeys = [
      "razorpay_payments_scanned",
      "razorpay_payments_captured",
      "active_local_subscriptions",
      "mismatches",
    ];
    for (const k of tKeys) {
      if (typeof body.totals?.[k] === "number") ok(`totals.${k} is a number`);
      else fail(`totals.${k} is a number`, `got ${typeof body.totals?.[k]}`);
    }
    if (Array.isArray(body.mismatches)) ok("mismatches is an array");
    else fail("mismatches is an array", `got ${typeof body.mismatches}`);
  } else if (res.status === 503) {
    const body = await res.json();
    ok("503 with clear error when Razorpay keys missing");
    if (body?.error?.toLowerCase().includes("razorpay")) ok("error message mentions Razorpay");
    else fail("error message mentions Razorpay", `got: ${JSON.stringify(body)}`);
  } else {
    fail(
      "expected 200 (success) or 503 (missing keys)",
      `got ${res.status}: ${await res.text()}`
    );
  }

  // -------------------------------------------------------------------------
  console.log("\n3) GET also works (Vercel cron sends GET)");
  {
    const g = await fetch(ENDPOINT + `?secret=${encodeURIComponent(CRON_SECRET)}`);
    if (g.status === 200 || g.status === 503) ok(`GET → ${g.status}`);
    else fail("GET returns 200 or 503", `got ${g.status}`);
  }

  console.log(
    `\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed\n`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
