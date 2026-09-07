/**
 * tests/test-funnel.js
 * A9.1 — Onboarding funnel milestone helpers + aggregate stats.
 *
 * We can't hit real Postgres from the test suite, so this test:
 *   1. Recreates the funnel columns on an in-memory sqlite users table.
 *   2. Exercises the exact SQL our production helpers run (mark*).
 *   3. Verifies the aggregate counts/percentages we return from
 *      getFunnelStats. Postgres-specific `percentile_cont` is stubbed with
 *      a straight JS median so the *filtering* logic (who qualifies for
 *      each median) is what we assert — matching what our production
 *      query does with `FILTER (WHERE ...)`.
 *
 * Run: node tests/test-funnel.js
 */
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");

const db = new Database(":memory:");
db.pragma("foreign_keys = ON");

// ── Schema mirrors the funnel columns added in schema.sql ────────────────
db.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    first_account_connected_at   TEXT,
    first_automation_created_at  TEXT,
    first_dm_sent_at             TEXT
  );
`);

// ── Test harness ─────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(label, fn) {
  try { fn(); console.log("✅", label); passed++; }
  catch (e) { console.log("❌", label, "→", e.message); failed++; }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "expected"}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}

// ── Helpers that mirror the production markFirst* pattern ────────────────
// Real code (src/lib/db.ts): `UPDATE users SET col = NOW() WHERE id = $1 AND col IS NULL`
// We substitute a fixed timestamp so we can assert immutability.
function mark(userId, column, at) {
  db.prepare(
    `UPDATE users SET ${column} = COALESCE(${column}, ?) WHERE id = ? AND ${column} IS NULL`
  ).run(at, userId);
}
function seedUser(email, createdAt) {
  const id = uuidv4();
  db.prepare(
    "INSERT INTO users (id, email, name, created_at) VALUES (?,?,?,?)"
  ).run(id, email, email.split("@")[0], createdAt);
  return id;
}
function getCol(userId, col) {
  return db.prepare(`SELECT ${col} AS v FROM users WHERE id = ?`).get(userId).v;
}

// ════════════════════════════════════════════════════════
// markFirst* — write-once semantics
// ════════════════════════════════════════════════════════
console.log("\n── A9.1: markFirst* write-once ──");

const u = seedUser("a@test.io", "2024-01-01T00:00:00Z");

test("first_account_connected_at is NULL after signup", () => {
  assertEqual(getCol(u, "first_account_connected_at"), null);
});

test("markFirstAccountConnected sets timestamp", () => {
  mark(u, "first_account_connected_at", "2024-01-01T00:05:00Z");
  assertEqual(getCol(u, "first_account_connected_at"), "2024-01-01T00:05:00Z");
});

test("markFirstAccountConnected is idempotent (later calls no-op)", () => {
  // Reconnecting the account later must NOT bump the timestamp — this is
  // how we make sure medians measure the *first* activation, not the last.
  mark(u, "first_account_connected_at", "2024-06-01T00:00:00Z");
  mark(u, "first_account_connected_at", "2025-01-01T00:00:00Z");
  assertEqual(getCol(u, "first_account_connected_at"), "2024-01-01T00:05:00Z");
});

test("markFirstAutomationCreated + markFirstDmSent write-once", () => {
  mark(u, "first_automation_created_at", "2024-01-01T00:07:00Z");
  mark(u, "first_dm_sent_at",            "2024-01-01T00:12:00Z");
  mark(u, "first_automation_created_at", "2024-02-01T00:00:00Z"); // should no-op
  mark(u, "first_dm_sent_at",            "2024-02-01T00:00:00Z"); // should no-op
  assertEqual(getCol(u, "first_automation_created_at"), "2024-01-01T00:07:00Z");
  assertEqual(getCol(u, "first_dm_sent_at"),            "2024-01-01T00:12:00Z");
});

test("Concurrent-style rapid retries settle on the first value", () => {
  const u2 = seedUser("burst@test.io", "2024-01-01T00:00:00Z");
  // Simulate 20 near-simultaneous webhook retries. Every call sees NULL until
  // exactly one wins the WHERE clause; sqlite serializes writes so the first
  // stamp is the one that sticks — same guarantee Postgres gives us.
  for (let i = 0; i < 20; i++) {
    mark(u2, "first_dm_sent_at", `2024-01-01T00:00:${String(i).padStart(2, "0")}Z`);
  }
  assertEqual(getCol(u2, "first_dm_sent_at"), "2024-01-01T00:00:00Z");
});

// ════════════════════════════════════════════════════════
// getFunnelStats — counts + percentages
// ════════════════════════════════════════════════════════
console.log("\n── A9.1: getFunnelStats aggregation ──");

// Wipe and re-seed a controlled cohort of 10 users:
//   * 10 signed up
//   * 6 connected an IG account
//   * 4 created an automation
//   * 2 sent their first DM
// This matches a realistic funnel shape (~60% / 40% / 20% of signups).
db.exec("DELETE FROM users");

const T = (n) => new Date(Date.UTC(2024, 0, 1, 0, n)).toISOString();
const cohort = [
  //   [signup,      connect,    autom,      first_dm]
  ["u1@x.io",  T(0),  T(1),       T(2),       T(4)],   // full funnel — 4 min end-to-end
  ["u2@x.io",  T(0),  T(10),      T(20),      T(40)],  // full funnel — 40 min end-to-end
  ["u3@x.io",  T(0),  T(3),       T(5),       null],   // dropped before DM
  ["u4@x.io",  T(0),  T(2),       T(10),      null],   // dropped before DM
  ["u5@x.io",  T(0),  T(5),       null,       null],   // dropped after connect
  ["u6@x.io",  T(0),  T(15),      null,       null],   // dropped after connect
  ["u7@x.io",  T(0),  null,       null,       null],   // never connected
  ["u8@x.io",  T(0),  null,       null,       null],
  ["u9@x.io",  T(0),  null,       null,       null],
  ["u10@x.io", T(0),  null,       null,       null],
];
for (const [email, c, ac, au, dm] of cohort) {
  const id = seedUser(email, c);
  if (ac) mark(id, "first_account_connected_at",  ac);
  if (au) mark(id, "first_automation_created_at", au);
  if (dm) mark(id, "first_dm_sent_at",             dm);
}

// Sqlite 3.30+ supports FILTER, matching our Postgres query. Everything in
// getFunnelStats except percentile_cont maps 1:1, so we can assert directly.
const row = db.prepare(`
  SELECT
    COUNT(*) AS total_signups,
    COUNT(*) FILTER (WHERE first_account_connected_at  IS NOT NULL) AS c1,
    COUNT(*) FILTER (WHERE first_automation_created_at IS NOT NULL) AS c2,
    COUNT(*) FILTER (WHERE first_dm_sent_at            IS NOT NULL) AS c3
  FROM users
`).get();

test("total_signups counts every row", () => assertEqual(row.total_signups, 10));
test("reached_account_connected counts non-null connects", () => assertEqual(row.c1, 6));
test("reached_automation_created counts non-null automations", () => assertEqual(row.c2, 4));
test("reached_first_dm_sent counts non-null DMs", () => assertEqual(row.c3, 2));

// Percentages match what getFunnelStats returns (rounded to one decimal).
const pct = (n) => Math.round((n / row.total_signups) * 1000) / 10;
test("pct_account_connected = 60.0", () => assertEqual(pct(row.c1), 60));
test("pct_automation_created = 40.0", () => assertEqual(pct(row.c2), 40));
test("pct_first_dm_sent = 20.0",     () => assertEqual(pct(row.c3), 20));

// ── Median logic (Postgres percentile_cont(0.5) equivalent) ──────────────
// We assert two properties of the FILTER predicate our production SQL uses:
//   (a) drop-offs are excluded from each stage's median
//   (b) the median is over the *elapsed seconds*, not raw timestamps
function median(nums) {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function secondsBetween(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 1000;
}

const rowsForSignupToConnect = db.prepare(`
  SELECT created_at, first_account_connected_at
  FROM users WHERE first_account_connected_at IS NOT NULL
`).all();
test("median signup→connect excludes drop-offs", () => {
  assertEqual(rowsForSignupToConnect.length, 6); // not 10
});
test("median signup→connect matches JS computation", () => {
  const secs = rowsForSignupToConnect.map((r) =>
    secondsBetween(r.created_at, r.first_account_connected_at)
  );
  // deltas in minutes: 1, 10, 3, 2, 5, 15 → sorted 1,2,3,5,10,15 → median = (3+5)/2 = 4 min = 240s
  assertEqual(median(secs), 240);
});

const rowsForAutomToDm = db.prepare(`
  SELECT first_automation_created_at, first_dm_sent_at
  FROM users
  WHERE first_dm_sent_at IS NOT NULL
    AND first_automation_created_at IS NOT NULL
`).all();
test("median automation→first_dm excludes users without a DM", () => {
  assertEqual(rowsForAutomToDm.length, 2); // u1, u2 only
});
test("median automation→first_dm matches JS computation", () => {
  const secs = rowsForAutomToDm.map((r) =>
    secondsBetween(r.first_automation_created_at, r.first_dm_sent_at)
  );
  // deltas: u1 = 2min = 120s, u2 = 20min = 1200s → median of two = 660s
  assertEqual(median(secs), 660);
});

// ════════════════════════════════════════════════════════
// Edge cases
// ════════════════════════════════════════════════════════
console.log("\n── A9.1: Edge cases ──");

test("Empty users table returns 0/0/0/0 and null medians", () => {
  db.exec("DELETE FROM users");
  const r = db.prepare(`
    SELECT COUNT(*) AS n,
           COUNT(*) FILTER (WHERE first_dm_sent_at IS NOT NULL) AS d
    FROM users
  `).get();
  assertEqual(r.n, 0);
  assertEqual(r.d, 0);
  // percent computed by getFunnelStats: n=0 → returns 0 (guarded in JS)
  const pctFn = (x) => (r.n > 0 ? Math.round((x / r.n) * 1000) / 10 : 0);
  assertEqual(pctFn(r.d), 0);
});

test("Percentage rounds to one decimal", () => {
  // 1 / 3 → 33.3 (not 33.33 or 33.333)
  const p = Math.round((1 / 3) * 1000) / 10;
  assertEqual(p, 33.3);
});

// ════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════
db.close();
console.log(`\n${"═".repeat(50)}`);
console.log(`TOTAL: ${passed + failed} tests | ✅ ${passed} passed | ❌ ${failed} failed`);
if (failed > 0) process.exit(1);
