/**
 * Load test for dm-shiyam API endpoints.
 *
 * Tests:
 *  - Concurrent GET /api/stats        (light read, no auth needed for 401 test)
 *  - Concurrent GET /api/analytics    (auth-guarded)
 *  - Concurrent GET /api/automations  (auth-guarded)
 *  - Concurrent POST /api/webhook/instagram  (rate-limiter + sig check)
 *
 * Run:  node tests/load-test.mjs
 * Requires: server running on http://localhost:3000
 */

const BASE = "http://localhost:3000";
const CONCURRENCY = 10;  // simultaneous requests per batch
const BATCHES = 3;       // how many batches to run

// ── helpers ────────────────────────────────────────────────────────
function now() { return performance.now(); }

async function timed(fn) {
  const start = now();
  let ok = false, status = 0, err = null;
  try {
    const res = await fn();
    status = res.status;
    ok = true;
  } catch (e) {
    err = e.message;
  }
  return { ms: now() - start, ok, status, err };
}

function stats(results) {
  const times = results.filter(r => r.ok).map(r => r.ms).sort((a, b) => a - b);
  if (!times.length) return { min: 0, max: 0, avg: 0, p95: 0, success: 0, total: results.length };
  const sum = times.reduce((a, b) => a + b, 0);
  return {
    min: Math.round(times[0]),
    max: Math.round(times[times.length - 1]),
    avg: Math.round(sum / times.length),
    p95: Math.round(times[Math.floor(times.length * 0.95)]),
    success: times.length,
    total: results.length,
  };
}

function printStats(label, s) {
  const rate = ((s.success / s.total) * 100).toFixed(0);
  console.log(`  ${label}`);
  console.log(`    requests: ${s.total}  success: ${s.success} (${rate}%)`);
  console.log(`    latency:  min=${s.min}ms  avg=${s.avg}ms  p95=${s.p95}ms  max=${s.max}ms`);
}

async function runBatch(fn, n) {
  return Promise.all(Array.from({ length: n }, () => timed(fn)));
}

// ── tests ──────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`Load test  —  ${CONCURRENCY} concurrent × ${BATCHES} batches`);
console.log(`${"═".repeat(50)}\n`);

// 1. Landing page
{
  console.log("1. GET / (landing page)");
  const all = [];
  for (let b = 0; b < BATCHES; b++) {
    const batch = await runBatch(() => fetch(`${BASE}/`), CONCURRENCY);
    all.push(...batch);
  }
  printStats("GET /", stats(all));
}

// 2. Unauthenticated requests to auth-guarded endpoints
//    Expected: fast 401s — the guard should short-circuit immediately
{
  console.log("\n2. GET /api/analytics (unauthenticated — expect 401)");
  const all = [];
  for (let b = 0; b < BATCHES; b++) {
    const batch = await runBatch(() => fetch(`${BASE}/api/analytics`), CONCURRENCY);
    all.push(...batch);
  }
  const s = stats(all);
  const got401 = all.filter(r => r.status === 401).length;
  printStats("GET /api/analytics", s);
  console.log(`    all returned 401: ${got401 === all.length ? "✅ yes" : "❌ no (" + got401 + "/" + all.length + ")"}`);
}

{
  console.log("\n3. GET /api/automations (unauthenticated — expect 401)");
  const all = [];
  for (let b = 0; b < BATCHES; b++) {
    const batch = await runBatch(() => fetch(`${BASE}/api/automations`), CONCURRENCY);
    all.push(...batch);
  }
  const s = stats(all);
  const got401 = all.filter(r => r.status === 401).length;
  printStats("GET /api/automations", s);
  console.log(`    all returned 401: ${got401 === all.length ? "✅ yes" : "❌ no (" + got401 + "/" + all.length + ")"}`);
}

// 3. Webhook endpoint under load — rate limiter engaged
{
  console.log("\n4. POST /api/webhook/instagram (rate limiter, RATE_LIMIT_MAX=5)");

  // Use a fixed test IP so the rate limiter triggers predictably
  const testIp = "172.16.0.1";
  const results = [];

  // Send 15 requests total — expect first 5 to pass limiter (then hit 403 sig),
  // the rest to get 429
  for (let i = 0; i < 15; i++) {
    const r = await timed(() =>
      fetch(`${BASE}/api/webhook/instagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": testIp,
        },
        body: JSON.stringify({ object: "instagram", entry: [] }),
      })
    );
    results.push(r);
  }

  const s = stats(results);
  const passed_rl = results.filter(r => r.status !== 429).length;
  const blocked = results.filter(r => r.status === 429).length;
  printStats("POST /api/webhook/instagram", s);
  console.log(`    passed rate limiter : ${passed_rl} (expected ≤5)`);
  console.log(`    rate-limited (429)  : ${blocked} (expected ≥10)`);
  console.log(`    rate limiter working: ${blocked >= 10 ? "✅ yes" : "❌ no"}`);
}

// 4. Concurrent stats reads
{
  console.log("\n5. GET /api/stats (unauthenticated — expect 401)");
  const all = [];
  for (let b = 0; b < BATCHES; b++) {
    const batch = await runBatch(() => fetch(`${BASE}/api/stats`), CONCURRENCY);
    all.push(...batch);
  }
  printStats("GET /api/stats", stats(all));
}

console.log(`\n${"═".repeat(50)}`);
console.log("Load test complete");
console.log(`${"═".repeat(50)}\n`);
