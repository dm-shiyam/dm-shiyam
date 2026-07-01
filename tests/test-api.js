/**
 * tests/test-api.js
 * HTTP integration tests for all API routes.
 * Run: node tests/test-api.js  (requires dev server on port 3002)
 */
const http = require("http");

const PORT = process.env.PORT || 3002;

function req(method, path, body) {
  return new Promise((resolve) => {
    const b = body ? JSON.stringify(body) : null;
    const opts = {
      host: "localhost", port: PORT, path, method,
      headers: b
        ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(b) }
        : {},
    };
    const r = http.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(d); } catch {}
        resolve({ status: res.statusCode, body: d, json });
      });
    });
    r.on("error", (e) => resolve({ status: "ERR", body: e.message, json: null }));
    if (b) r.write(b);
    r.end();
  });
}

let passed = 0, failed = 0;
function test(label, fn) {
  return fn().then(() => {
    console.log("✅", label);
    passed++;
  }).catch((e) => {
    console.log("❌", label, "→", e.message);
    failed++;
  });
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "Assertion failed"); }
function assertEqual(a, b) { if (a !== b) throw new Error(`Expected ${b}, got ${a}`); }

async function run() {
  // ── PAGES ─────────────────────────────────────────────
  console.log("\n── Pages (expect 200) ──");
  for (const [path, label] of [
    ["/", "Home page"],
    ["/pricing", "Pricing page"],
    ["/terms", "Terms of Service page"],
    ["/privacy", "Privacy Policy page"],
    ["/login", "Login page"],
    ["/register", "Register page"],
  ]) {
    await test(label, async () => {
      const r = await req("GET", path);
      assertEqual(r.status, 200);
    });
  }

  // ── AUTH GUARD ─────────────────────────────────────────
  console.log("\n── Auth Guard (expect 401) ──");
  for (const [path, label] of [
    ["/api/stats", "Stats API"],
    ["/api/automations", "Automations API"],
    ["/api/accounts", "Accounts API"],
    ["/api/activity", "Activity log API"],
    ["/api/webhook/health", "Webhook health API"],
    ["/api/activity/export?format=csv", "CSV export API"],
    ["/api/analytics", "Analytics API"],
  ]) {
    await test(label + " requires auth", async () => {
      const r = await req("GET", path);
      assertEqual(r.status, 401);
      assert(r.json?.error, "Should return JSON error");
    });
  }

  // ── WEBHOOK SECURITY ───────────────────────────────────
  console.log("\n── Webhook Security ──");

  await test("Webhook GET: wrong verify token → 403", async () => {
    const r = await req("GET", "/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=test");
    assertEqual(r.status, 403);
  });

  await test("Webhook GET: empty verify token → 403", async () => {
    const r = await req("GET", "/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=&hub.challenge=test");
    assertEqual(r.status, 403);
  });

  await test("Webhook GET: wrong mode → 403", async () => {
    const r = await req("GET", "/api/webhook/instagram?hub.mode=unsubscribe&hub.verify_token=test&hub.challenge=test");
    assertEqual(r.status, 403);
  });

  await test("Webhook POST: no signature → 403", async () => {
    const r = await req("POST", "/api/webhook/instagram", { object: "instagram", entry: [] });
    assertEqual(r.status, 403);
  });

  await test("Webhook POST: invalid JSON body → 400 or 403", async () => {
    const r = await new Promise((resolve) => {
      const b = "not-json";
      const opts = {
        host: "localhost", port: PORT,
        path: "/api/webhook/instagram", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(b) },
      };
      const rq = http.request(opts, (res) => {
        let d = ""; res.on("data", c => d += c);
        res.on("end", () => resolve({ status: res.statusCode }));
      });
      rq.on("error", e => resolve({ status: "ERR" }));
      rq.write(b); rq.end();
    });
    assert([400, 403].includes(r.status), `Expected 400 or 403, got ${r.status}`);
  });

  // ── BILLING SECURITY ────────────────────────────────────
  console.log("\n── Billing Security ──");

  await test("Billing checkout: no auth → 401", async () => {
    const r = await req("POST", "/api/billing/checkout", { plan: "pro" });
    assertEqual(r.status, 401);
  });

  await test("Billing verify: no auth → 401", async () => {
    const r = await req("POST", "/api/billing/verify", { razorpay_payment_id: "x", razorpay_subscription_id: "x", razorpay_signature: "x" });
    assertEqual(r.status, 401);
  });

  await test("Billing webhook: no signature → 401", async () => {
    const r = await req("POST", "/api/billing/webhook", { event: "subscription.activated" });
    assertEqual(r.status, 401);
  });

  // ── AI TEST SECURITY ────────────────────────────────────
  console.log("\n── AI Test Security ──");

  await test("AI test: no auth → 401", async () => {
    const r = await req("POST", "/api/ai/test", { commentText: "hi", commenterUsername: "user" });
    assertEqual(r.status, 401);
  });

  // ── SCHEDULE SECURITY ───────────────────────────────────
  console.log("\n── Schedule Security ──");

  await test("Automation schedule: no auth → 401", async () => {
    const r = await req("PUT", "/api/automations/schedule", { id: "test" });
    assertEqual(r.status, 401);
  });

  // ── CRON ROUTES ────────────────────────────────────────
  console.log("\n── Cron Routes (respond = OK) ──");

  await test("Cron reset-dm-usage: responds", async () => {
    const r = await req("GET", "/api/cron/reset-dm-usage");
    assert([200, 401, 500].includes(r.status), `Got ${r.status}`);
  });

  await test("Cron refresh-tokens: responds", async () => {
    const r = await req("GET", "/api/cron/refresh-tokens");
    assert([200, 401, 500].includes(r.status), `Got ${r.status}`);
  });

  // ── V10: WEBHOOK EVENT FIELDS ──────────────────────────
  console.log("\n── V10: Story/Reel trigger fields (no APP_SECRET = pass sig check) ──");

  await test("Webhook POST with mentions field: processed (200) or blocked (403)", async () => {
    const payload = JSON.stringify({
      object: "instagram",
      entry: [{ id: "123", changes: [{ field: "mentions", value: { from: { id: "u1", username: "tester" }, text: "link" } }] }]
    });
    const r = await new Promise((resolve) => {
      const opts = {
        host: "localhost", port: PORT,
        path: "/api/webhook/instagram", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      };
      const rq = http.request(opts, (res) => {
        let d = ""; res.on("data", c => d += c);
        res.on("end", () => resolve({ status: res.statusCode }));
      });
      rq.on("error", e => resolve({ status: "ERR" }));
      rq.write(payload); rq.end();
    });
    // 200 = processed (no APP_SECRET set = sig skipped), 403 = sig required
    assert([200, 403].includes(r.status), `Expected 200 or 403, got ${r.status}`);
  });

  // ── SUMMARY ────────────────────────────────────────────
  console.log(`\n${"═".repeat(50)}`);
  console.log(`TOTAL: ${passed + failed} tests | ✅ ${passed} passed | ❌ ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Test runner error:", e); process.exit(1); });
