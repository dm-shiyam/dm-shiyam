/**
 * Integration tests for the security fixes applied on 2026-06-30:
 *
 *  1. PUT  /api/automations  — must reject unauthenticated + cross-user requests
 *  2. DELETE /api/automations — same
 *  3. PUT  /api/accounts     — same
 *  4. DELETE /api/accounts   — same
 *  5. GET  /api/analytics    — must reject unauthenticated requests
 *  6. POST /api/billing/webhook — timing-safe signature check
 *  7. Webhook rate limit at threshold of 5 (RATE_LIMIT_MAX=5)
 *
 * Run:  node tests/test-security-fixes.mjs
 * Requires: server running on http://localhost:3000
 *           RATE_LIMIT_MAX=5 set in .env.local
 */

const BASE = "http://localhost:3000";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function req(method, path, { body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* text response */ }
  return { status: res.status, json };
}

// ════════════════════════════════════════
// 1 & 2 — PUT / DELETE /api/automations
// ════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log("1. PUT /api/automations — auth guard");
console.log("══════════════════════════════════════════");

{
  const r = await req("PUT", "/api/automations", {
    body: { id: "any-id", name: "hacked" },
  });
  assert(r.status === 401, `No session → 401 (got ${r.status})`);
  assert(r.json?.error === "Unauthorized", `Body says Unauthorized`);
}

console.log("\n══════════════════════════════════════════");
console.log("2. DELETE /api/automations — auth guard");
console.log("══════════════════════════════════════════");

{
  const r = await req("DELETE", "/api/automations?id=any-id");
  assert(r.status === 401, `No session → 401 (got ${r.status})`);
  assert(r.json?.error === "Unauthorized", `Body says Unauthorized`);
}

// ════════════════════════════════════════
// 3 & 4 — PUT / DELETE /api/accounts
// ════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log("3. PUT /api/accounts — auth guard");
console.log("══════════════════════════════════════════");

{
  const r = await req("PUT", "/api/accounts", {
    body: { id: "any-id", instagram_username: "hacked" },
  });
  assert(r.status === 401, `No session → 401 (got ${r.status})`);
  assert(r.json?.error === "Unauthorized", `Body says Unauthorized`);
}

console.log("\n══════════════════════════════════════════");
console.log("4. DELETE /api/accounts — auth guard");
console.log("══════════════════════════════════════════");

{
  const r = await req("DELETE", "/api/accounts?id=any-id");
  assert(r.status === 401, `No session → 401 (got ${r.status})`);
  assert(r.json?.error === "Unauthorized", `Body says Unauthorized`);
}

// ════════════════════════════════════════
// 5 — GET /api/analytics — auth guard
// ════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log("5. GET /api/analytics — auth guard");
console.log("══════════════════════════════════════════");

{
  const r = await req("GET", "/api/analytics");
  assert(r.status === 401, `No session → 401 (got ${r.status})`);
  assert(r.json?.error === "Unauthorized", `Body says Unauthorized`);
}

{
  const r = await req("GET", "/api/analytics?days=7");
  assert(r.status === 401, `days param still rejected without auth (got ${r.status})`);
}

// ════════════════════════════════════════
// 6 — Billing webhook — bad signature
// ════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log("6. POST /api/billing/webhook — bad signature rejected");
console.log("══════════════════════════════════════════");

{
  const r = await req("POST", "/api/billing/webhook", {
    body: { event: "subscription.activated" },
    headers: { "x-razorpay-signature": "bad-signature" },
  });
  assert(r.status === 400, `Wrong signature → 400 (got ${r.status})`);
  assert(r.json?.error === "Invalid signature", `Body says Invalid signature`);
}

{
  // No signature header at all
  const r = await req("POST", "/api/billing/webhook", {
    body: { event: "subscription.activated" },
  });
  assert(r.status === 400, `Missing signature → 400 (got ${r.status})`);
}

// ════════════════════════════════════════
// 7 — Webhook rate limit (RATE_LIMIT_MAX=5)
// ════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log("7. Webhook rate limit at threshold 5");
console.log("══════════════════════════════════════════");

{
  // Send 5 valid-looking (but unsigned) requests — they'll fail sig verification
  // but the rate limiter runs BEFORE sig check so we can observe the 429
  // We use a unique fake IP via X-Forwarded-For each test run to avoid
  // collisions with previous tests
  const testIp = `10.0.0.${Math.floor(Math.random() * 200) + 10}`;
  const headers = { "X-Forwarded-For": testIp };

  let allowed = 0;
  let blocked = 0;

  for (let i = 1; i <= 7; i++) {
    const res = await fetch(`${BASE}/api/webhook/instagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ object: "instagram", entry: [] }),
    });
    if (res.status === 429) blocked++;
    else allowed++;
  }

  assert(allowed === 5, `First 5 requests pass rate limiter (got ${allowed})`);
  assert(blocked === 2, `Requests 6 and 7 are rate-limited (got ${blocked})`);
}

{
  // A different IP should have its own independent counter
  const otherIp = "192.168.99.99";
  const res = await fetch(`${BASE}/api/webhook/instagram`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": otherIp },
    body: JSON.stringify({ object: "instagram", entry: [] }),
  });
  assert(res.status !== 429, `Different IP is not rate limited (got ${res.status})`);
}

// ════════════════════════════════════════
// Summary
// ════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("══════════════════════════════════════════");
if (failed > 0) process.exit(1);
