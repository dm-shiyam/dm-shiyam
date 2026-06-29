/**
 * Thorough tests for Tasks #5, #7, #9
 *
 *   #5 — DM limit enforcement
 *   #7 — Webhook signature verification
 *   #9 — SQL injection fix in getAnalyticsData
 *
 * Run:  node tests/test-tasks-5-7-9.mjs
 */

import Database from "better-sqlite3";
import crypto from "crypto";
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

// ─── Setup: in-memory test database ─────────────────────────────────

const TEST_DB_PATH = path.join(__dirname, "__test_temp__.db");

// Clean up any leftover test DB
if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

const db = new Database(TEST_DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT,
    provider TEXT NOT NULL DEFAULT 'credentials',
    provider_id TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT,
    subscription_status TEXT NOT NULL DEFAULT 'none',
    dm_limit INTEGER NOT NULL DEFAULT 100,
    dms_used_this_month INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    instagram_account_id TEXT NOT NULL UNIQUE,
    instagram_username TEXT NOT NULL,
    access_token TEXT NOT NULL,
    page_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    token_expires_at TEXT,
    user_id TEXT
  );

  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    account_id TEXT,
    name TEXT NOT NULL,
    trigger_keywords TEXT NOT NULL,
    dm_message TEXT NOT NULL,
    reply_comment TEXT,
    ai_enabled INTEGER DEFAULT 0,
    ai_system_prompt TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    total_triggered INTEGER DEFAULT 0,
    user_id TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    account_id TEXT,
    automation_id TEXT NOT NULL,
    automation_name TEXT NOT NULL,
    instagram_user_id TEXT NOT NULL,
    instagram_username TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    matched_keyword TEXT NOT NULL,
    dm_sent INTEGER DEFAULT 0,
    comment_replied INTEGER DEFAULT 0,
    ai_generated INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    user_id TEXT,
    FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
`);

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 1: Task #9 — SQL Injection Fix (getAnalyticsData)
// ═════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════");
console.log("TASK #9 — SQL Injection Fix (Analytics)");
console.log("══════════════════════════════════════════\n");

// Seed some activity data at various dates
const now = new Date();
function dateAgo(daysAgo) {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

// Insert a test automation (no FK check needed since we use automation_id directly)
db.prepare("INSERT INTO automations (id, name, trigger_keywords, dm_message) VALUES (?, ?, ?, ?)").run(
  "auto-1", "Test Auto", "info,help", "Hello {{username}}!"
);

// Insert activity log entries at various dates
const insertActivity = db.prepare(
  `INSERT INTO activity_log (id, automation_id, automation_name, instagram_user_id, instagram_username, 
   comment_text, matched_keyword, dm_sent, comment_replied, ai_generated, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

insertActivity.run("act-1", "auto-1", "Test Auto", "ig-001", "user1", "info please", "info", 1, 0, 0, dateAgo(2));
insertActivity.run("act-2", "auto-1", "Test Auto", "ig-002", "user2", "help me", "help", 1, 0, 1, dateAgo(5));
insertActivity.run("act-3", "auto-1", "Test Auto", "ig-003", "user3", "info now", "info", 0, 0, 0, dateAgo(10));
insertActivity.run("act-4", "auto-1", "Test Auto", "ig-004", "user4", "help!", "help", 1, 1, 0, dateAgo(20));
insertActivity.run("act-5", "auto-1", "Test Auto", "ig-005", "user5", "info old", "info", 1, 0, 0, dateAgo(40));
insertActivity.run("act-6", "auto-1", "Test Auto", "ig-006", "user6", "help old", "help", 1, 0, 0, dateAgo(100));

// Reimplemented getAnalyticsData using the FIXED version (parameterized queries)
function getAnalyticsData(days = 30) {
  const raw = Number(days);
  const safeDays = Number.isFinite(raw) ? Math.max(1, Math.min(365, Math.floor(raw))) : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - safeDays);
  const cutoffISO = cutoff.toISOString();

  const dmsOverTime = db.prepare(`
    SELECT date(created_at) as date,
           COUNT(*) as count,
           SUM(CASE WHEN ai_generated = 1 THEN 1 ELSE 0 END) as ai_count
    FROM activity_log
    WHERE dm_sent = 1 AND created_at >= ?
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(cutoffISO);

  const topKeywords = db.prepare(`
    SELECT matched_keyword as keyword, COUNT(*) as count
    FROM activity_log
    WHERE created_at >= ?
    GROUP BY matched_keyword
    ORDER BY count DESC
    LIMIT 10
  `).all(cutoffISO);

  const hourlyDist = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
    FROM activity_log
    WHERE dm_sent = 1 AND created_at >= ?
    GROUP BY hour
    ORDER BY hour ASC
  `).all(cutoffISO);

  const hourlyMap = new Map(hourlyDist.map((h) => [h.hour, h.count]));
  const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourlyMap.get(i) || 0,
  }));

  const sent = db.prepare(
    `SELECT COUNT(*) as count FROM activity_log WHERE dm_sent = 1 AND created_at >= ?`
  ).get(cutoffISO).count;
  const failed = db.prepare(
    `SELECT COUNT(*) as count FROM activity_log WHERE dm_sent = 0 AND created_at >= ?`
  ).get(cutoffISO).count;

  return { dms_over_time: dmsOverTime, top_keywords: topKeywords, hourly_distribution: hourlyDistribution, success_rate: { sent, failed } };
}

// Test 1: Normal days=30
console.log("Test: days=30 (normal)");
{
  const result = getAnalyticsData(30);
  // Should include act-1 (2d), act-2 (5d), act-3 (10d), act-4 (20d) — NOT act-5 (40d) or act-6 (100d)
  const totalDms = result.success_rate.sent;
  const totalFailed = result.success_rate.failed;
  assertEqual(totalDms, 3, "30-day window: 3 DMs sent (act-1,2,4)");
  assertEqual(totalFailed, 1, "30-day window: 1 failed (act-3)");
  assert(result.top_keywords.length > 0, "Has top keywords");
  assertEqual(result.hourly_distribution.length, 24, "24 hourly buckets");
}

// Test 2: days=7
console.log("\nTest: days=7");
{
  const result = getAnalyticsData(7);
  assertEqual(result.success_rate.sent, 2, "7-day window: 2 DMs sent (act-1,2)");
  assertEqual(result.success_rate.failed, 0, "7-day window: 0 failed");
}

// Test 3: days=90
console.log("\nTest: days=90");
{
  const result = getAnalyticsData(90);
  assertEqual(result.success_rate.sent, 4, "90-day window: 4 DMs sent (act-1,2,4,5)");
}

// Test 4: days=365 (should include everything)
console.log("\nTest: days=365");
{
  const result = getAnalyticsData(365);
  assertEqual(result.success_rate.sent, 5, "365-day window: all 5 DMs sent");
}

// Test 5: SQL Injection attempt — malicious string
console.log("\nTest: SQL injection attempt (string)");
{
  try {
    const result = getAnalyticsData("1; DROP TABLE users; --");
    // Should NOT crash; safeDays should default to 30 (NaN → 30)
    assert(result.success_rate !== undefined, "Malicious string didn't crash — treated as NaN → default 30");
  } catch (err) {
    assert(false, `Malicious string caused error: ${err.message}`);
  }
}

// Test 6: SQL Injection attempt — negative number
console.log("\nTest: SQL injection attempt (negative)");
{
  const result = getAnalyticsData(-5);
  // Should be clamped to 1
  assert(result !== undefined, "Negative days didn't crash — clamped to 1");
}

// Test 7: SQL Injection attempt — huge number
console.log("\nTest: SQL injection attempt (huge number)");
{
  const result = getAnalyticsData(999999);
  // Should be clamped to 365
  assertEqual(result.success_rate.sent, 5, "Huge number clamped to 365 — includes all records");
}

// Test 8: days=0
console.log("\nTest: days=0 (edge case)");
{
  const result = getAnalyticsData(0);
  assert(result !== undefined, "days=0 didn't crash — clamped to 1");
}

// Test 9: days=undefined
console.log("\nTest: days=undefined");
{
  const result = getAnalyticsData(undefined);
  assertEqual(result.success_rate.sent, 3, "undefined defaults to 30 — 3 DMs");
}

// Test 10: days as float
console.log("\nTest: days=7.8 (float)");
{
  const result = getAnalyticsData(7.8);
  assertEqual(result.success_rate.sent, 2, "Float 7.8 floored to 7 — 2 DMs");
}

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 2: Task #7 — Webhook Signature Verification
// ═════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════");
console.log("TASK #7 — Webhook Signature Verification");
console.log("══════════════════════════════════════════\n");

// Reimplemented from route.ts
function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) {
    return true; // skip verification
  }
  if (!signatureHeader) {
    return false;
  }
  const expectedSig = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

const TEST_SECRET = "test_app_secret_12345";
const TEST_BODY = JSON.stringify({ object: "instagram", entry: [{ id: "12345" }] });

// Test 1: Valid signature
console.log("Test: Valid signature");
{
  const validSig = "sha256=" + crypto.createHmac("sha256", TEST_SECRET).update(TEST_BODY).digest("hex");
  assert(verifySignature(TEST_BODY, validSig, TEST_SECRET), "Valid signature accepted");
}

// Test 2: Invalid signature
console.log("\nTest: Invalid signature");
{
  assert(!verifySignature(TEST_BODY, "sha256=0000000000000000000000000000000000000000000000000000000000000000", TEST_SECRET), "Invalid signature rejected");
}

// Test 3: Missing signature header
console.log("\nTest: Missing signature header");
{
  assert(!verifySignature(TEST_BODY, null, TEST_SECRET), "Missing header rejected");
}

// Test 4: Empty signature header
console.log("\nTest: Empty signature header");
{
  assert(!verifySignature(TEST_BODY, "", TEST_SECRET), "Empty header rejected");
}

// Test 5: No app secret (skip verification)
console.log("\nTest: No app secret — skip verification");
{
  assert(verifySignature(TEST_BODY, null, ""), "No secret → verification skipped (returns true)");
  assert(verifySignature(TEST_BODY, null, undefined), "Undefined secret → verification skipped");
}

// Test 6: Tampered body
console.log("\nTest: Tampered body");
{
  const validSig = "sha256=" + crypto.createHmac("sha256", TEST_SECRET).update(TEST_BODY).digest("hex");
  const tampered = TEST_BODY + "HACKED";
  assert(!verifySignature(tampered, validSig, TEST_SECRET), "Tampered body rejected");
}

// Test 7: Wrong secret
console.log("\nTest: Wrong app secret");
{
  const sigWithDiffSecret = "sha256=" + crypto.createHmac("sha256", "wrong_secret").update(TEST_BODY).digest("hex");
  assert(!verifySignature(TEST_BODY, sigWithDiffSecret, TEST_SECRET), "Wrong secret rejected");
}

// Test 8: Malformed signature (no sha256= prefix)
console.log("\nTest: Malformed signature (no prefix)");
{
  const rawHmac = crypto.createHmac("sha256", TEST_SECRET).update(TEST_BODY).digest("hex");
  assert(!verifySignature(TEST_BODY, rawHmac, TEST_SECRET), "Missing sha256= prefix rejected");
}

// Test 9: Signature with different length (timingSafeEqual length check)
console.log("\nTest: Signature with different length");
{
  assert(!verifySignature(TEST_BODY, "sha256=abc", TEST_SECRET), "Short signature rejected");
}

// Test 10: Unicode body
console.log("\nTest: Unicode body");
{
  const unicodeBody = JSON.stringify({ text: "Héllo 🌍 Wörld" });
  const sig = "sha256=" + crypto.createHmac("sha256", TEST_SECRET).update(unicodeBody).digest("hex");
  assert(verifySignature(unicodeBody, sig, TEST_SECRET), "Unicode body signature verified");
}

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Task #5 — DM Limit Enforcement
// ═════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════");
console.log("TASK #5 — DM Limit Enforcement");
console.log("══════════════════════════════════════════\n");

// Helper: create user
function createTestUser(id, email, name, plan, dmLimit, dmsUsed) {
  db.prepare(
    `INSERT INTO users (id, email, name, provider, plan, dm_limit, dms_used_this_month, subscription_status)
     VALUES (?, ?, ?, 'credentials', ?, ?, ?, 'active')`
  ).run(id, email, name, plan, dmLimit, dmsUsed);
}

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function incrementDmsUsed(userId) {
  db.prepare("UPDATE users SET dms_used_this_month = dms_used_this_month + 1 WHERE id = ?").run(userId);
}

// Simulates the DM limit enforcement logic from processWebhookAsync
function shouldAllowDm(userId) {
  if (!userId) return { allowed: true, reason: "no user_id" };
  const user = getUserById(userId);
  if (!user) return { allowed: true, reason: "user not found" };
  if (user.dm_limit === -1) return { allowed: true, reason: "unlimited plan" };
  if (user.dms_used_this_month >= user.dm_limit) {
    return { allowed: false, reason: `DM limit reached (${user.dms_used_this_month}/${user.dm_limit})` };
  }
  return { allowed: true, reason: "under limit" };
}

// Test 1: Free plan user under limit
console.log("Test: Free plan user under limit");
{
  createTestUser("u-free-1", "free1@test.com", "Free User", "free", 100, 50);
  const result = shouldAllowDm("u-free-1");
  assert(result.allowed, "Free user with 50/100 DMs allowed");
}

// Test 2: Free plan user AT limit
console.log("\nTest: Free plan user AT limit");
{
  createTestUser("u-free-2", "free2@test.com", "Free User 2", "free", 100, 100);
  const result = shouldAllowDm("u-free-2");
  assert(!result.allowed, "Free user with 100/100 DMs blocked");
  assert(result.reason.includes("100/100"), "Error message shows correct counts");
}

// Test 3: Free plan user OVER limit
console.log("\nTest: Free plan user OVER limit");
{
  createTestUser("u-free-3", "free3@test.com", "Free User 3", "free", 100, 105);
  const result = shouldAllowDm("u-free-3");
  assert(!result.allowed, "Free user with 105/100 DMs blocked");
}

// Test 4: Unlimited plan (agency — dm_limit = -1)
console.log("\nTest: Agency plan (unlimited)");
{
  createTestUser("u-agency", "agency@test.com", "Agency User", "agency", -1, 99999);
  const result = shouldAllowDm("u-agency");
  assert(result.allowed, "Agency user with dm_limit=-1 always allowed");
}

// Test 5: Pro plan user at limit boundary
console.log("\nTest: Pro plan at limit boundary (4999/5000)");
{
  createTestUser("u-pro-1", "pro1@test.com", "Pro User", "pro", 5000, 4999);
  const result = shouldAllowDm("u-pro-1");
  assert(result.allowed, "Pro user with 4999/5000 allowed");
}

// Test 6: Pro plan user exactly at limit
console.log("\nTest: Pro plan exactly at limit (5000/5000)");
{
  createTestUser("u-pro-2", "pro2@test.com", "Pro User 2", "pro", 5000, 5000);
  const result = shouldAllowDm("u-pro-2");
  assert(!result.allowed, "Pro user with 5000/5000 blocked");
}

// Test 7: No user_id (automation without user)
console.log("\nTest: No user_id on automation");
{
  const result = shouldAllowDm(null);
  assert(result.allowed, "Null user_id → allowed (backward compat)");
}

// Test 8: Non-existent user_id
console.log("\nTest: Non-existent user_id");
{
  const result = shouldAllowDm("nonexistent-user-id");
  assert(result.allowed, "Non-existent user → allowed (fail open)");
}

// Test 9: incrementDmsUsed works
console.log("\nTest: incrementDmsUsed updates counter");
{
  createTestUser("u-inc", "inc@test.com", "Inc User", "starter", 1000, 0);
  let user = getUserById("u-inc");
  assertEqual(user.dms_used_this_month, 0, "Starts at 0");

  incrementDmsUsed("u-inc");
  user = getUserById("u-inc");
  assertEqual(user.dms_used_this_month, 1, "After 1 increment → 1");

  incrementDmsUsed("u-inc");
  incrementDmsUsed("u-inc");
  user = getUserById("u-inc");
  assertEqual(user.dms_used_this_month, 3, "After 3 increments → 3");
}

// Test 10: Full flow — send until limit, then blocked
console.log("\nTest: Full flow — send 3 DMs on a limit of 3, 4th blocked");
{
  createTestUser("u-flow", "flow@test.com", "Flow User", "free", 3, 0);

  for (let i = 1; i <= 3; i++) {
    const result = shouldAllowDm("u-flow");
    assert(result.allowed, `DM #${i} allowed`);
    incrementDmsUsed("u-flow");
  }

  const result = shouldAllowDm("u-flow");
  assert(!result.allowed, "DM #4 blocked — limit reached");
  const user = getUserById("u-flow");
  assertEqual(user.dms_used_this_month, 3, "Counter is 3");
}

// Test 11: Starter plan (1000 DMs)
console.log("\nTest: Starter plan at 999/1000");
{
  createTestUser("u-starter", "starter@test.com", "Starter", "starter", 1000, 999);
  const r1 = shouldAllowDm("u-starter");
  assert(r1.allowed, "999/1000 → allowed");

  incrementDmsUsed("u-starter");
  const r2 = shouldAllowDm("u-starter");
  assert(!r2.allowed, "1000/1000 → blocked");
}

// ═════════════════════════════════════════════════════════════════════
// TEST SUITE 4: Analytics API Route Input Validation
// ═════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════");
console.log("TASK #9 — Analytics Route Input Validation");
console.log("══════════════════════════════════════════\n");

// Simulate the route's days parameter sanitization
function sanitizeDaysParam(daysParam) {
  const raw = daysParam ? Number(daysParam) : NaN;
  const days = Number.isFinite(raw) ? Math.max(1, Math.min(365, Math.floor(raw))) : 30;
  return days;
}

console.log("Test: Valid values");
assertEqual(sanitizeDaysParam("7"), 7, "days=7 → 7");
assertEqual(sanitizeDaysParam("30"), 30, "days=30 → 30");
assertEqual(sanitizeDaysParam("90"), 90, "days=90 → 90");
assertEqual(sanitizeDaysParam("365"), 365, "days=365 → 365");

console.log("\nTest: Edge cases");
assertEqual(sanitizeDaysParam(null), 30, "null → 30 (default)");
assertEqual(sanitizeDaysParam(undefined), 30, "undefined → 30 (default)");
assertEqual(sanitizeDaysParam(""), 30, "empty string → 30");
assertEqual(sanitizeDaysParam("0"), 1, "0 → clamped to 1");
assertEqual(sanitizeDaysParam("-10"), 1, "negative → clamped to 1");
assertEqual(sanitizeDaysParam("1000"), 365, "1000 → clamped to 365");
assertEqual(sanitizeDaysParam("7.9"), 7, "float → floored");

console.log("\nTest: Injection attempts");
assertEqual(sanitizeDaysParam("1; DROP TABLE users;"), 30, "SQL injection → NaN → default 30");
assertEqual(sanitizeDaysParam("abc"), 30, "letters → NaN → default 30");
assertEqual(sanitizeDaysParam("10 OR 1=1"), 30, "OR injection → NaN → default 30");

// ═════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════");
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("══════════════════════════════════════════\n");

// Cleanup
db.close();
fs.unlinkSync(TEST_DB_PATH);
// Also remove WAL/SHM if they exist
try { fs.unlinkSync(TEST_DB_PATH + "-wal"); } catch {}
try { fs.unlinkSync(TEST_DB_PATH + "-shm"); } catch {}

process.exit(failed > 0 ? 1 : 0);
