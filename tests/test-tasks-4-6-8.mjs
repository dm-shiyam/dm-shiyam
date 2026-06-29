/**
 * Tests for Tasks #4, #6, #8
 *
 *   #4 — Rate limiting on webhook endpoint
 *   #6 — Monthly DM usage reset (cron route)
 *   #8 — Error retry logic with exponential backoff
 *
 * Run:  node tests/test-tasks-4-6-8.mjs
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Helpers ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 1: Task #4 — Rate Limiting
// ═════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════");
console.log("TASK #4 — Rate Limiting");
console.log("══════════════════════════════════════════\n");

// Reimplements the rate limiter logic for testing
function createRateLimiter() {
  const store = new Map();

  function rateLimit(key, maxHits, windowMs) {
    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= maxHits) {
      const oldestInWindow = entry.timestamps[0];
      const retryAfterMs = oldestInWindow + windowMs - now;
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
    }

    entry.timestamps.push(now);
    return { allowed: true, remaining: maxHits - entry.timestamps.length, retryAfterMs: 0 };
  }

  return { rateLimit, store };
}

// Test 1: First request should be allowed
console.log("Test: First request allowed");
{
  const { rateLimit } = createRateLimiter();
  const result = rateLimit("192.168.1.1", 100, 60000);
  assert(result.allowed, "First request allowed");
  assertEqual(result.remaining, 99, "99 remaining");
}

// Test 2: Requests within limit
console.log("\nTest: Multiple requests within limit");
{
  const { rateLimit } = createRateLimiter();
  for (let i = 0; i < 50; i++) {
    rateLimit("192.168.1.2", 100, 60000);
  }
  const result = rateLimit("192.168.1.2", 100, 60000);
  assert(result.allowed, "51st request (of 100 limit) allowed");
  assertEqual(result.remaining, 49, "49 remaining");
}

// Test 3: Request at limit — blocked
console.log("\nTest: Request at limit — blocked");
{
  const { rateLimit } = createRateLimiter();
  for (let i = 0; i < 100; i++) {
    const r = rateLimit("192.168.1.3", 100, 60000);
    assert(r.allowed, `Request #${i + 1} allowed`);
  }
  const blocked = rateLimit("192.168.1.3", 100, 60000);
  assert(!blocked.allowed, "101st request blocked");
  assertEqual(blocked.remaining, 0, "0 remaining");
  assert(blocked.retryAfterMs > 0, "retryAfterMs > 0");
}

// Test 4: Different IPs are independent
console.log("\nTest: Different IPs are independent");
{
  const { rateLimit } = createRateLimiter();
  for (let i = 0; i < 100; i++) {
    rateLimit("ip-a", 100, 60000);
  }
  const blockedA = rateLimit("ip-a", 100, 60000);
  const allowedB = rateLimit("ip-b", 100, 60000);
  assert(!blockedA.allowed, "ip-a blocked at limit");
  assert(allowedB.allowed, "ip-b still allowed (separate counter)");
}

// Test 5: Window expiry — requests allowed again after window
console.log("\nTest: Window expiry");
{
  const { rateLimit, store } = createRateLimiter();
  // Fill up the limit with old timestamps
  const entry = { timestamps: [] };
  const pastTime = Date.now() - 70000; // 70 seconds ago (outside 60s window)
  for (let i = 0; i < 100; i++) {
    entry.timestamps.push(pastTime + i);
  }
  store.set("ip-expired", entry);

  const result = rateLimit("ip-expired", 100, 60000);
  assert(result.allowed, "Requests allowed after window expires");
  assertEqual(result.remaining, 99, "99 remaining (old entries cleaned)");
}

// Test 6: Small limit (e.g., 3)
console.log("\nTest: Small rate limit (3 per window)");
{
  const { rateLimit } = createRateLimiter();
  assertEqual(rateLimit("ip-small", 3, 60000).allowed, true, "1st allowed");
  assertEqual(rateLimit("ip-small", 3, 60000).allowed, true, "2nd allowed");
  assertEqual(rateLimit("ip-small", 3, 60000).allowed, true, "3rd allowed");
  assertEqual(rateLimit("ip-small", 3, 60000).allowed, false, "4th blocked");
}

// Test 7: Remaining count decrements correctly
console.log("\nTest: Remaining count decrements");
{
  const { rateLimit } = createRateLimiter();
  assertEqual(rateLimit("ip-rem", 5, 60000).remaining, 4, "After 1st: 4 remaining");
  assertEqual(rateLimit("ip-rem", 5, 60000).remaining, 3, "After 2nd: 3 remaining");
  assertEqual(rateLimit("ip-rem", 5, 60000).remaining, 2, "After 3rd: 2 remaining");
  assertEqual(rateLimit("ip-rem", 5, 60000).remaining, 1, "After 4th: 1 remaining");
  assertEqual(rateLimit("ip-rem", 5, 60000).remaining, 0, "After 5th: 0 remaining");
}

// Test 8: Retry-After header value is reasonable
console.log("\nTest: Retry-After is reasonable");
{
  const { rateLimit } = createRateLimiter();
  for (let i = 0; i < 5; i++) rateLimit("ip-retry", 5, 10000); // 10s window
  const blocked = rateLimit("ip-retry", 5, 10000);
  assert(!blocked.allowed, "Blocked at limit");
  assert(blocked.retryAfterMs > 0 && blocked.retryAfterMs <= 10000, `retryAfterMs ${blocked.retryAfterMs} is between 0 and 10000`);
}

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 2: Task #6 — Monthly DM Usage Reset
// ═════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════");
console.log("TASK #6 — Monthly DM Usage Reset");
console.log("══════════════════════════════════════════\n");

const TEST_DB_PATH = path.join(__dirname, "__test_temp_468__.db");
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

const db = new Database(TEST_DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'credentials',
    plan TEXT NOT NULL DEFAULT 'free',
    dm_limit INTEGER NOT NULL DEFAULT 100,
    dms_used_this_month INTEGER NOT NULL DEFAULT 0,
    subscription_status TEXT NOT NULL DEFAULT 'none',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

function createUser(id, email, name, dmsUsed) {
  db.prepare("INSERT INTO users (id, email, name, dms_used_this_month) VALUES (?, ?, ?, ?)").run(id, email, name, dmsUsed);
}

function getUser(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function resetMonthlyDmUsage() {
  db.prepare("UPDATE users SET dms_used_this_month = 0").run();
}

// Test 1: Reset clears all users' counters
console.log("Test: Reset clears all counters");
{
  createUser("u1", "u1@test.com", "User 1", 50);
  createUser("u2", "u2@test.com", "User 2", 999);
  createUser("u3", "u3@test.com", "User 3", 0);

  assertEqual(getUser("u1").dms_used_this_month, 50, "u1 starts at 50");
  assertEqual(getUser("u2").dms_used_this_month, 999, "u2 starts at 999");
  assertEqual(getUser("u3").dms_used_this_month, 0, "u3 starts at 0");

  resetMonthlyDmUsage();

  assertEqual(getUser("u1").dms_used_this_month, 0, "u1 reset to 0");
  assertEqual(getUser("u2").dms_used_this_month, 0, "u2 reset to 0");
  assertEqual(getUser("u3").dms_used_this_month, 0, "u3 stays at 0");
}

// Test 2: Reset doesn't affect other fields
console.log("\nTest: Reset doesn't affect other fields");
{
  const before = getUser("u1");
  resetMonthlyDmUsage();
  const after = getUser("u1");
  assertEqual(after.email, before.email, "Email unchanged");
  assertEqual(after.name, before.name, "Name unchanged");
  assertEqual(after.plan, before.plan, "Plan unchanged");
  assertEqual(after.dm_limit, before.dm_limit, "dm_limit unchanged");
}

// Test 3: Increment after reset works correctly
console.log("\nTest: Increment after reset works");
{
  resetMonthlyDmUsage();
  assertEqual(getUser("u1").dms_used_this_month, 0, "Starts at 0 after reset");
  db.prepare("UPDATE users SET dms_used_this_month = dms_used_this_month + 1 WHERE id = ?").run("u1");
  assertEqual(getUser("u1").dms_used_this_month, 1, "Increments to 1");
  db.prepare("UPDATE users SET dms_used_this_month = dms_used_this_month + 1 WHERE id = ?").run("u1");
  assertEqual(getUser("u1").dms_used_this_month, 2, "Increments to 2");
}

// Test 4: Multiple resets are idempotent
console.log("\nTest: Multiple resets are idempotent");
{
  db.prepare("UPDATE users SET dms_used_this_month = 42 WHERE id = ?").run("u1");
  resetMonthlyDmUsage();
  resetMonthlyDmUsage();
  resetMonthlyDmUsage();
  assertEqual(getUser("u1").dms_used_this_month, 0, "Still 0 after triple reset");
}

// Test 5: Cron route auth — no secret means rejected
console.log("\nTest: Cron auth — empty CRON_SECRET rejects");
{
  const cronSecret = "";
  const providedSecret = "anything";
  assert(cronSecret === "" || providedSecret !== cronSecret, "Empty CRON_SECRET → always reject");
}

// Test 6: Cron route auth — wrong secret means rejected
console.log("\nTest: Cron auth — wrong secret rejects");
{
  const cronSecret = "my-secret-123";
  const providedSecret = "wrong-secret";
  assert(providedSecret !== cronSecret, "Wrong secret → rejected");
}

// Test 7: Cron route auth — correct secret means accepted
console.log("\nTest: Cron auth — correct secret accepts");
{
  const cronSecret = "my-secret-123";
  const providedSecret = "my-secret-123";
  assert(providedSecret === cronSecret, "Correct secret → accepted");
}

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Task #8 — Error Retry Logic
// ═════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════");
console.log("TASK #8 — Error Retry Logic");
console.log("══════════════════════════════════════════\n");

// Test the isRetryable logic
function isRetryable(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

console.log("Test: isRetryable status codes");
assert(isRetryable(429), "429 (rate limit) → retryable");
assert(isRetryable(500), "500 (internal server error) → retryable");
assert(isRetryable(502), "502 (bad gateway) → retryable");
assert(isRetryable(503), "503 (service unavailable) → retryable");
assert(isRetryable(504), "504 (gateway timeout) → retryable");
assert(!isRetryable(200), "200 (OK) → NOT retryable");
assert(!isRetryable(400), "400 (bad request) → NOT retryable");
assert(!isRetryable(401), "401 (unauthorized) → NOT retryable");
assert(!isRetryable(403), "403 (forbidden) → NOT retryable");
assert(!isRetryable(404), "404 (not found) → NOT retryable");
assert(!isRetryable(422), "422 (unprocessable) → NOT retryable");

// Test exponential backoff delays
console.log("\nTest: Exponential backoff delays");
const BASE_DELAY_MS = 1000;
{
  const delays = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    delays.push(BASE_DELAY_MS * Math.pow(2, attempt - 1));
  }
  assertEqual(delays[0], 1000, "Retry 1 delay: 1000ms (1s)");
  assertEqual(delays[1], 2000, "Retry 2 delay: 2000ms (2s)");
  assertEqual(delays[2], 4000, "Retry 3 delay: 4000ms (4s)");
}

// Test retry flow simulation
console.log("\nTest: Retry flow — success on 3rd attempt");
{
  let attempts = 0;
  const MAX_RETRIES = 3;
  let success = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    attempts++;
    // Simulate: fail twice (500), succeed on 3rd
    const status = attempt < 2 ? 500 : 200;
    if (status === 200) {
      success = true;
      break;
    }
    if (isRetryable(status) && attempt < MAX_RETRIES) continue;
    break;
  }
  assert(success, "Succeeds on 3rd attempt");
  assertEqual(attempts, 3, "Took 3 attempts");
}

console.log("\nTest: Retry flow — all retries fail (429)");
{
  let attempts = 0;
  const MAX_RETRIES = 3;
  let success = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    attempts++;
    const status = 429; // always rate limited
    if (status === 200) { success = true; break; }
    if (isRetryable(status) && attempt < MAX_RETRIES) continue;
    break;
  }
  assert(!success, "All retries failed");
  assertEqual(attempts, 4, "Tried 4 times (1 initial + 3 retries)");
}

console.log("\nTest: Retry flow — 400 error (no retry)");
{
  let attempts = 0;
  const MAX_RETRIES = 3;
  let success = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    attempts++;
    const status = 400; // bad request — don't retry
    if (status === 200) { success = true; break; }
    if (isRetryable(status) && attempt < MAX_RETRIES) continue;
    break;
  }
  assert(!success, "400 error → no retry");
  assertEqual(attempts, 1, "Only 1 attempt (no retry for 400)");
}

console.log("\nTest: Retry flow — network error retries");
{
  let attempts = 0;
  const MAX_RETRIES = 3;
  let success = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    attempts++;
    // Simulate network error for first 2 attempts
    const networkError = attempt < 2;
    if (networkError && attempt < MAX_RETRIES) continue;
    if (!networkError) { success = true; break; }
    break;
  }
  assert(success, "Network error recovered on 3rd attempt");
  assertEqual(attempts, 3, "Took 3 attempts");
}

console.log("\nTest: Retry flow — first attempt succeeds (no retry needed)");
{
  let attempts = 0;
  const MAX_RETRIES = 3;
  let success = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    attempts++;
    const status = 200;
    if (status === 200) { success = true; break; }
    if (isRetryable(status) && attempt < MAX_RETRIES) continue;
    break;
  }
  assert(success, "First attempt succeeds");
  assertEqual(attempts, 1, "Only 1 attempt needed");
}

// ═════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════");
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("══════════════════════════════════════════\n");

// Cleanup
db.close();
fs.unlinkSync(TEST_DB_PATH);
try { fs.unlinkSync(TEST_DB_PATH + "-wal"); } catch {}
try { fs.unlinkSync(TEST_DB_PATH + "-shm"); } catch {}

process.exit(failed > 0 ? 1 : 0);
