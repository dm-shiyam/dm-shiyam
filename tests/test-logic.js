/**
 * tests/test-logic.js
 * Pure logic unit tests — no DB, no HTTP, no external deps.
 * Tests: keyword matching, message personalization, schedule logic,
 *        webhook health status, CSV export format, dedup logic.
 * Run: node tests/test-logic.js
 */

let passed = 0, failed = 0;
function test(label, fn) {
  try { fn(); console.log("✅", label); passed++; }
  catch (e) { console.log("❌", label, "→", e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "Assertion failed"); }
function assertEqual(a, b) { if (a !== b) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ════════════════════════════════════════════════════════
// KEYWORD MATCHING (webhook logic)
// ════════════════════════════════════════════════════════
console.log("\n── Keyword Matching ──");

function matchKeyword(commentText, keywordsStr) {
  const keywords = keywordsStr.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
  const lower = commentText.toLowerCase();
  return keywords.find(kw => lower.includes(kw)) || null;
}

test("Exact keyword match", () => assertEqual(matchKeyword("Send me the link", "link,price"), "link"));
test("Case-insensitive match", () => assertEqual(matchKeyword("SEND ME THE LINK", "link,price"), "link"));
test("Partial word match", () => assertEqual(matchKeyword("pricing info please", "price,link"), "price"));
test("Second keyword matches when first doesn't", () => assertEqual(matchKeyword("what is the price?", "link,price"), "price"));
test("No match returns null", () => assertEqual(matchKeyword("hello world", "link,price"), null));
test("Empty keywords returns null", () => assertEqual(matchKeyword("link", ""), null));
test("Whitespace in keywords handled", () => assertEqual(matchKeyword("link here", " link , price "), "link"));
test("Emoji in comment still matches keyword", () => assertEqual(matchKeyword("🔥 link please!", "link"), "link"));
test("Multiple keywords — first match wins", () => assertEqual(matchKeyword("link and price", "link,price"), "link"));

// ════════════════════════════════════════════════════════
// MESSAGE PERSONALIZATION
// ════════════════════════════════════════════════════════
console.log("\n── Message Personalization ──");

function personalizeMessage(template, username) {
  return template.replace(/\{username\}/gi, username);
}

test("Replaces {username} placeholder", () => assertEqual(personalizeMessage("Hey {username}!", "john"), "Hey john!"));
test("Case-insensitive replacement", () => assertEqual(personalizeMessage("Hi {USERNAME}", "jane"), "Hi jane"));
test("Multiple placeholders replaced", () => assertEqual(personalizeMessage("Hi {username}, I'm sending to {username}", "bob"), "Hi bob, I'm sending to bob"));
test("No placeholder — message unchanged", () => assertEqual(personalizeMessage("Hello there!", "user"), "Hello there!"));
test("Empty username handled", () => assertEqual(personalizeMessage("Hi {username}", ""), "Hi "));

// ════════════════════════════════════════════════════════
// SCHEDULE LOGIC (V6)
// ════════════════════════════════════════════════════════
console.log("\n── Schedule Logic (V6) ──");

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

test("Inactive automation always returns false", () => assert(!isAutomationActiveNow({ is_active: false, schedule_enabled: false })));
test("Active + schedule disabled → always active", () => assert(isAutomationActiveNow({ is_active: true, schedule_enabled: false })));
test("Active + schedule all-day all-week → active", () => assert(isAutomationActiveNow({ is_active: 1, schedule_enabled: 1, schedule_start_hour: 0, schedule_end_hour: 23, schedule_days: "0,1,2,3,4,5,6" })));
test("Numeric is_active=0 treated as inactive", () => assert(!isAutomationActiveNow({ is_active: 0, schedule_enabled: 0 })));
test("Numeric is_active=1 treated as active", () => assert(isAutomationActiveNow({ is_active: 1, schedule_enabled: 0 })));
test("Schedule with empty days → never active", () => assert(!isAutomationActiveNow({ is_active: 1, schedule_enabled: 1, schedule_start_hour: 0, schedule_end_hour: 23, schedule_days: "" })));

// ════════════════════════════════════════════════════════
// WEBHOOK HEALTH STATUS (V9)
// ════════════════════════════════════════════════════════
console.log("\n── Webhook Health Status (V9) ──");

function computeHealthStatus(lastReceivedAt) {
  if (!lastReceivedAt) return "never_received";
  const minutesSinceLast = Math.floor((Date.now() - new Date(lastReceivedAt).getTime()) / 60000);
  if (minutesSinceLast > 60) return "stale";
  return "healthy";
}

test("No last_received_at → never_received", () => assertEqual(computeHealthStatus(null), "never_received"));
test("Received 1 minute ago → healthy", () => {
  const t = new Date(Date.now() - 60000).toISOString();
  assertEqual(computeHealthStatus(t), "healthy");
});
test("Received 30 mins ago → healthy", () => {
  const t = new Date(Date.now() - 30 * 60000).toISOString();
  assertEqual(computeHealthStatus(t), "healthy");
});
test("Received 61 mins ago → stale", () => {
  const t = new Date(Date.now() - 61 * 60000).toISOString();
  assertEqual(computeHealthStatus(t), "stale");
});
test("Received 2 hours ago → stale", () => {
  const t = new Date(Date.now() - 120 * 60000).toISOString();
  assertEqual(computeHealthStatus(t), "stale");
});

// ════════════════════════════════════════════════════════
// CSV EXPORT FORMAT (V5)
// ════════════════════════════════════════════════════════
console.log("\n── CSV Export Format (V5) ──");

function escapeCSV(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSVRow(activity) {
  return [
    activity.id, activity.created_at, activity.automation_name,
    activity.instagram_username, activity.comment_text, activity.matched_keyword,
    activity.dm_sent ? "yes" : "no",
    activity.comment_replied ? "yes" : "no",
    activity.ai_generated ? "yes" : "no",
    activity.error_message ?? "",
  ].map(escapeCSV).join(",");
}

test("CSV row basic fields", () => {
  const row = buildCSVRow({ id: "abc", created_at: "2025-01-01", automation_name: "Test", instagram_username: "user1", comment_text: "hi", matched_keyword: "hi", dm_sent: true, comment_replied: false, ai_generated: false });
  assert(row.includes("abc"), "has id");
  assert(row.includes("user1"), "has username");
  assert(row.includes("yes"), "dm_sent=yes");
  assert(row.includes("no"), "comment_replied=no");
});

test("CSV escapes commas in values", () => {
  const escaped = escapeCSV("hello, world");
  assertEqual(escaped, '"hello, world"');
});

test("CSV escapes quotes in values", () => {
  const escaped = escapeCSV('say "hi"');
  assertEqual(escaped, '"say ""hi"""');
});

test("CSV escapes newlines in values", () => {
  const escaped = escapeCSV("line1\nline2");
  assertEqual(escaped, '"line1\nline2"');
});

test("CSV null value → empty string", () => assertEqual(escapeCSV(null), ""));
test("CSV undefined value → empty string", () => assertEqual(escapeCSV(undefined), ""));
test("CSV boolean false → no in row", () => {
  const row = buildCSVRow({ id:"x", created_at:"", automation_name:"", instagram_username:"", comment_text:"", matched_keyword:"", dm_sent: false, comment_replied: false, ai_generated: false });
  const parts = row.split(",");
  assertEqual(parts[6], "no"); // dm_sent
});

// ════════════════════════════════════════════════════════
// DUPLICATE DM DEDUP LOGIC (V2)
// ════════════════════════════════════════════════════════
console.log("\n── Dedup Logic (V2) ──");

// Simulate the in-memory sent_dms set
const sentDms = new Map(); // key: automationId+igUserId
function hasDmBeenSent(automationId, igUserId) { return sentDms.has(`${automationId}:${igUserId}`); }
function recordSentDm(automationId, igUserId) { sentDms.set(`${automationId}:${igUserId}`, true); }

test("hasDmBeenSent false before any record", () => assert(!hasDmBeenSent("auto1", "user1")));
test("hasDmBeenSent true after record", () => { recordSentDm("auto1", "user1"); assert(hasDmBeenSent("auto1", "user1")); });
test("Different automation same user → not a dupe", () => assert(!hasDmBeenSent("auto2", "user1")));
test("Same automation different user → not a dupe", () => assert(!hasDmBeenSent("auto1", "user2")));
test("Record multiple — all tracked independently", () => {
  recordSentDm("auto1", "user2");
  recordSentDm("auto2", "user1");
  assert(hasDmBeenSent("auto1", "user1"));
  assert(hasDmBeenSent("auto1", "user2"));
  assert(hasDmBeenSent("auto2", "user1"));
  assert(!hasDmBeenSent("auto2", "user2"));
});

// ════════════════════════════════════════════════════════
// TOKEN EXPIRY LOGIC (V4)
// ════════════════════════════════════════════════════════
console.log("\n── Token Expiry Logic (V4) ──");

function isTokenExpiringSoon(expiresAt, thresholdDays = 7) {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  const threshold = new Date(Date.now() + thresholdDays * 24 * 60 * 60 * 1000);
  return expiry <= threshold;
}

function computeExpiryDate(expiresIn) {
  if (expiresIn <= 0) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

test("Token expiring in 3 days → expiring soon", () => {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  assert(isTokenExpiringSoon(d, 7));
});
test("Token expiring in 30 days → not expiring soon", () => {
  const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  assert(!isTokenExpiringSoon(d, 7));
});
test("Already expired token → expiring soon", () => {
  const d = new Date(Date.now() - 1000).toISOString();
  assert(isTokenExpiringSoon(d, 7));
});
test("Null token_expires_at → not expiring", () => assert(!isTokenExpiringSoon(null)));
test("computeExpiryDate with 5184000s (60 days) → future date", () => {
  const d = computeExpiryDate(5184000);
  assert(new Date(d) > new Date(), "Should be in the future");
});
test("computeExpiryDate with 0 or negative → null", () => assertEqual(computeExpiryDate(0), null));
test("computeExpiryDate with -1 → null", () => assertEqual(computeExpiryDate(-1), null));

// ════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(50)}`);
console.log(`TOTAL: ${passed + failed} tests | ✅ ${passed} passed | ❌ ${failed} failed`);
if (failed > 0) process.exit(1);
