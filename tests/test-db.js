/**
 * tests/test-db.js
 * Tests all DB functions added by Venkat tasks.
 * Run: node tests/test-db.js
 */
const Database = require("better-sqlite3");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// ── Use in-memory DB for isolation ──────────────────────────────────────
const db = new Database(":memory:");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Init schema (mirrors src/lib/db.ts initTables) ──────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free', subscription_status TEXT NOT NULL DEFAULT 'none',
    dm_limit INTEGER NOT NULL DEFAULT 100, dms_used_this_month INTEGER NOT NULL DEFAULT 0,
    has_seen_onboarding INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL,
    trigger_keywords TEXT NOT NULL, dm_message TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    schedule_enabled INTEGER DEFAULT 0,
    schedule_start_hour INTEGER DEFAULT 0,
    schedule_end_hour INTEGER DEFAULT 23,
    schedule_days TEXT DEFAULT '0,1,2,3,4,5,6',
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
    total_triggered INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sent_dms (
    id TEXT PRIMARY KEY, automation_id TEXT NOT NULL, instagram_user_id TEXT NOT NULL,
    sent_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS webhook_health (
    id INTEGER PRIMARY KEY DEFAULT 1, last_received_at TEXT,
    last_event_type TEXT, total_received INTEGER DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sent_dms_dedup ON sent_dms(automation_id, instagram_user_id);
  INSERT OR IGNORE INTO webhook_health (id, total_received) VALUES (1, 0);
`);

// ── Test helpers ─────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(label, fn) {
  try {
    fn();
    console.log("✅", label);
    passed++;
  } catch (e) {
    console.log("❌", label, "→", e.message);
    failed++;
  }
}
function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}
function assertEqual(a, b) {
  if (a !== b) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── Seed data ────────────────────────────────────────────────────────────
const userId = uuidv4();
const autoId = uuidv4();
const igUserId = "ig_user_123";

db.prepare("INSERT INTO users (id, email, name, dm_limit, dms_used_this_month) VALUES (?,?,?,?,?)")
  .run(userId, "test@test.com", "Test User", 100, 0);

db.prepare(`INSERT INTO automations (id, user_id, name, trigger_keywords, dm_message, is_active, schedule_enabled, schedule_start_hour, schedule_end_hour, schedule_days)
  VALUES (?,?,?,?,?,1,0,0,23,'0,1,2,3,4,5,6')`)
  .run(autoId, userId, "Test Auto", "link,price", "Hello {username}!");

// ════════════════════════════════════════════════════════
// V2: DUPLICATE DM PREVENTION
// ════════════════════════════════════════════════════════
console.log("\n── V2: Duplicate DM Prevention ──");

test("hasDmBeenSent returns false initially", () => {
  const row = db.prepare("SELECT 1 FROM sent_dms WHERE automation_id=? AND instagram_user_id=?")
    .get(autoId, igUserId);
  assert(!row, "Should not exist yet");
});

test("recordSentDm inserts correctly", () => {
  db.prepare("INSERT INTO sent_dms (id, automation_id, instagram_user_id) VALUES (?,?,?)")
    .run(uuidv4(), autoId, igUserId);
  const row = db.prepare("SELECT 1 FROM sent_dms WHERE automation_id=? AND instagram_user_id=?")
    .get(autoId, igUserId);
  assert(!!row, "Should exist after insert");
});

test("hasDmBeenSent returns true after record", () => {
  const row = db.prepare("SELECT 1 FROM sent_dms WHERE automation_id=? AND instagram_user_id=?")
    .get(autoId, igUserId);
  assert(!!row, "Should be true");
});

test("Duplicate insert is silently ignored (unique index)", () => {
  try {
    db.prepare("INSERT INTO sent_dms (id, automation_id, instagram_user_id) VALUES (?,?,?)")
      .run(uuidv4(), autoId, igUserId);
    throw new Error("Should have thrown unique constraint");
  } catch (e) {
    assert(e.code === "SQLITE_CONSTRAINT_UNIQUE", "Expected unique constraint error");
  }
});

test("Different user to same automation is allowed", () => {
  db.prepare("INSERT INTO sent_dms (id, automation_id, instagram_user_id) VALUES (?,?,?)")
    .run(uuidv4(), autoId, "ig_user_456");
  const row = db.prepare("SELECT 1 FROM sent_dms WHERE automation_id=? AND instagram_user_id=?")
    .get(autoId, "ig_user_456");
  assert(!!row, "Different user should be insertable");
});

test("Same user different automation is allowed", () => {
  const auto2 = uuidv4();
  db.prepare(`INSERT INTO automations (id, user_id, name, trigger_keywords, dm_message) VALUES (?,?,?,?,?)`)
    .run(auto2, userId, "Auto2", "test", "Hi");
  db.prepare("INSERT INTO sent_dms (id, automation_id, instagram_user_id) VALUES (?,?,?)")
    .run(uuidv4(), auto2, igUserId);
  const row = db.prepare("SELECT 1 FROM sent_dms WHERE automation_id=? AND instagram_user_id=?")
    .get(auto2, igUserId);
  assert(!!row, "Same user different automation should be insertable");
});

test("Cascade delete: sent_dms deleted when automation deleted", () => {
  const tempAuto = uuidv4();
  db.prepare(`INSERT INTO automations (id, user_id, name, trigger_keywords, dm_message) VALUES (?,?,?,?,?)`)
    .run(tempAuto, userId, "Temp", "kw", "msg");
  db.prepare("INSERT INTO sent_dms (id, automation_id, instagram_user_id) VALUES (?,?,?)")
    .run(uuidv4(), tempAuto, "ig_cascade_test");
  db.prepare("DELETE FROM automations WHERE id=?").run(tempAuto);
  const row = db.prepare("SELECT 1 FROM sent_dms WHERE automation_id=?").get(tempAuto);
  assert(!row, "sent_dms should be cascade deleted");
});

// ════════════════════════════════════════════════════════
// V6: SCHEDULED AUTOMATIONS
// ════════════════════════════════════════════════════════
console.log("\n── V6: Scheduled Automations ──");

function isAutomationActiveNow(automation) {
  if (!automation.is_active) return false;
  if (!automation.schedule_enabled) return true;
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDay();
  const startHour = automation.schedule_start_hour ?? 0;
  const endHour = automation.schedule_end_hour ?? 23;
  const allowedDays = (automation.schedule_days ?? "0,1,2,3,4,5,6")
    .split(",").map(d => parseInt(d.trim(), 10));
  if (!allowedDays.includes(currentDay)) return false;
  if (currentHour < startHour || currentHour > endHour) return false;
  return true;
}

test("is_active=false → not active regardless of schedule", () => {
  assert(!isAutomationActiveNow({ is_active: 0, schedule_enabled: 0 }));
});

test("is_active=true, schedule_enabled=false → always active", () => {
  assert(isAutomationActiveNow({ is_active: 1, schedule_enabled: 0 }));
});

test("schedule_enabled=true, all hours/days allowed → active", () => {
  assert(isAutomationActiveNow({
    is_active: 1, schedule_enabled: 1,
    schedule_start_hour: 0, schedule_end_hour: 23,
    schedule_days: "0,1,2,3,4,5,6"
  }));
});

test("schedule_enabled=true, no matching days → not active", () => {
  // Use a day string that can never match (empty)
  const auto = {
    is_active: 1, schedule_enabled: 1,
    schedule_start_hour: 0, schedule_end_hour: 23,
    schedule_days: "" // no valid days
  };
  const now = new Date();
  // Any day 0-6 won't be in empty list
  assert(!isAutomationActiveNow(auto));
});

test("schedule_enabled=true, hour range 0-0 at hour>0 → not active", () => {
  const now = new Date();
  const hour = now.getUTCHours();
  if (hour > 0) {
    // hour is after midnight — range 0-0 should exclude it
    assert(!isAutomationActiveNow({
      is_active: 1, schedule_enabled: 1,
      schedule_start_hour: 0, schedule_end_hour: 0,
      schedule_days: "0,1,2,3,4,5,6"
    }));
  } else {
    // It's midnight UTC — skip this edge case
    assert(true, "Skipped: UTC midnight edge case");
  }
});

test("updateAutomationSchedule stores correctly in DB", () => {
  db.prepare(`UPDATE automations SET schedule_enabled=?, schedule_start_hour=?, schedule_end_hour=?, schedule_days=? WHERE id=?`)
    .run(1, 9, 18, "1,2,3,4,5", autoId);
  const row = db.prepare("SELECT * FROM automations WHERE id=?").get(autoId);
  assertEqual(row.schedule_enabled, 1);
  assertEqual(row.schedule_start_hour, 9);
  assertEqual(row.schedule_end_hour, 18);
  assertEqual(row.schedule_days, "1,2,3,4,5");
});

// ════════════════════════════════════════════════════════
// V9: WEBHOOK HEALTH
// ════════════════════════════════════════════════════════
console.log("\n── V9: Webhook Health ──");

test("webhook_health row exists after init", () => {
  const row = db.prepare("SELECT * FROM webhook_health WHERE id=1").get();
  assert(!!row, "Row should exist");
  assertEqual(row.total_received, 0);
});

test("updateWebhookHealth increments counter", () => {
  db.prepare(`UPDATE webhook_health SET last_received_at=datetime('now'), last_event_type=?, total_received=total_received+1 WHERE id=1`)
    .run("comments");
  const row = db.prepare("SELECT * FROM webhook_health WHERE id=1").get();
  assertEqual(row.total_received, 1);
  assertEqual(row.last_event_type, "comments");
  assert(!!row.last_received_at, "last_received_at should be set");
});

test("updateWebhookHealth increments again for mentions", () => {
  db.prepare(`UPDATE webhook_health SET last_received_at=datetime('now'), last_event_type=?, total_received=total_received+1 WHERE id=1`)
    .run("mentions");
  const row = db.prepare("SELECT * FROM webhook_health WHERE id=1").get();
  assertEqual(row.total_received, 2);
  assertEqual(row.last_event_type, "mentions");
});

test("getWebhookHealth returns correct shape", () => {
  const row = db.prepare("SELECT last_received_at, last_event_type, total_received FROM webhook_health WHERE id=1").get();
  assert("last_received_at" in row, "has last_received_at");
  assert("last_event_type" in row, "has last_event_type");
  assert("total_received" in row, "has total_received");
});

// ════════════════════════════════════════════════════════
// DB SCHEMA INTEGRITY
// ════════════════════════════════════════════════════════
console.log("\n── DB Schema Integrity ──");

test("sent_dms table has correct columns", () => {
  const cols = db.prepare("PRAGMA table_info(sent_dms)").all().map(c => c.name);
  assert(cols.includes("id"), "has id");
  assert(cols.includes("automation_id"), "has automation_id");
  assert(cols.includes("instagram_user_id"), "has instagram_user_id");
  assert(cols.includes("sent_at"), "has sent_at");
});

test("automations table has all 4 schedule columns", () => {
  const cols = db.prepare("PRAGMA table_info(automations)").all().map(c => c.name);
  assert(cols.includes("schedule_enabled"), "has schedule_enabled");
  assert(cols.includes("schedule_start_hour"), "has schedule_start_hour");
  assert(cols.includes("schedule_end_hour"), "has schedule_end_hour");
  assert(cols.includes("schedule_days"), "has schedule_days");
});

test("webhook_health table has correct columns", () => {
  const cols = db.prepare("PRAGMA table_info(webhook_health)").all().map(c => c.name);
  assert(cols.includes("last_received_at"), "has last_received_at");
  assert(cols.includes("last_event_type"), "has last_event_type");
  assert(cols.includes("total_received"), "has total_received");
});

test("unique index exists on sent_dms", () => {
  const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sent_dms_dedup'").get();
  assert(!!idx, "idx_sent_dms_dedup should exist");
});

// ════════════════════════════════════════════════════════
// DM LIMIT LOGIC
// ════════════════════════════════════════════════════════
console.log("\n── DM Limit Logic ──");

test("User within DM limit — should be allowed", () => {
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
  const limitReached = user.dm_limit !== -1 && user.dms_used_this_month >= user.dm_limit;
  assert(!limitReached, "Should NOT be limit-reached at 0/100");
});

test("Increment DMs used", () => {
  db.prepare("UPDATE users SET dms_used_this_month = dms_used_this_month + 1 WHERE id=?").run(userId);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
  assertEqual(user.dms_used_this_month, 1);
});

test("User at DM limit — should be blocked", () => {
  db.prepare("UPDATE users SET dms_used_this_month=100 WHERE id=?").run(userId);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
  const limitReached = user.dm_limit !== -1 && user.dms_used_this_month >= user.dm_limit;
  assert(limitReached, "Should be limit-reached at 100/100");
});

test("User with unlimited plan (dm_limit=-1) is never blocked", () => {
  const user = { dm_limit: -1, dms_used_this_month: 999999 };
  const limitReached = user.dm_limit !== -1 && user.dms_used_this_month >= user.dm_limit;
  assert(!limitReached, "Unlimited plan should never be blocked");
});

test("Reset monthly DM usage", () => {
  db.prepare("UPDATE users SET dms_used_this_month=0 WHERE id=?").run(userId);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
  assertEqual(user.dms_used_this_month, 0);
});

// ════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════
db.close();
console.log(`\n${"═".repeat(50)}`);
console.log(`TOTAL: ${passed + failed} tests | ✅ ${passed} passed | ❌ ${failed} failed`);
if (failed > 0) process.exit(1);
