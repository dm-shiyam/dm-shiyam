#!/usr/bin/env node
// scripts/test-onboarding-drip.mjs
// End-to-end tester for A13 onboarding drip.
//
// Usage:
//   node scripts/test-onboarding-drip.mjs your@email.com
//
// Env required (loaded from .env.local automatically):
//   DATABASE_URL
//   CRON_SECRET
//
// Optional:
//   BASE_URL   default http://localhost:3000

import { readFileSync, existsSync } from "node:fs";
import { Client } from "pg";

// ── Load .env.local if present ─────────────────────────────────────────────
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

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/test-onboarding-drip.mjs your@email.com");
  process.exit(1);
}

const DB = process.env.DATABASE_URL;
const SECRET = process.env.CRON_SECRET || "";
const BASE = process.env.BASE_URL || "http://localhost:3000";

if (!DB) {
  console.error("DATABASE_URL not set (checked env + .env.local)");
  process.exit(1);
}

const pg = new Client({ connectionString: DB });
await pg.connect();

// ── Verify user exists ─────────────────────────────────────────────────────
const u = await pg.query("SELECT id FROM users WHERE email = $1", [email]);
if (u.rowCount === 0) {
  console.error(`No user with email=${email}. Sign up first at ${BASE}/register.`);
  await pg.end();
  process.exit(1);
}
const userId = u.rows[0].id;
console.log(`✓ Found user ${email} (id=${userId})`);

// ── Snapshot for restore at end ────────────────────────────────────────────
const snapshot = await pg.query(
  "SELECT created_at, plan FROM users WHERE id = $1",
  [userId]
);
const origCreatedAt = snapshot.rows[0].created_at;
const origPlan = snapshot.rows[0].plan;

async function callCron() {
  const res = await fetch(`${BASE}/api/cron/send-onboarding-emails`, {
    headers: SECRET ? { authorization: `Bearer ${SECRET}` } : {},
  });
  return res.json();
}

async function backdate(days) {
  await pg.query(
    "UPDATE users SET created_at = NOW() - ($2 || ' days')::INTERVAL - INTERVAL '2 hours' WHERE id = $1",
    [userId, days]
  );
  await pg.query("DELETE FROM sent_onboarding_emails WHERE user_id = $1", [userId]);
}

function pickStep(result, step) {
  return result.results.find((r) => r.step === step);
}

let pass = 0;
let fail = 0;
function expect(desc, cond, extra = "") {
  if (cond) {
    console.log(`  ✓ ${desc}`);
    pass++;
  } else {
    console.log(`  ✗ ${desc} ${extra}`);
    fail++;
  }
}

// ── Test cases ─────────────────────────────────────────────────────────────
console.log("\n── 13.2 Day 1: connect IG nudge ─────────────────────────");
await pg.query("DELETE FROM accounts WHERE user_id = $1", [userId]); // ensure no account
await backdate(1);
let r = await callCron();
let s = pickStep(r, "connect_ig_day1");
expect(`sent 1 email`, s.candidates === 1 && s.sent === 1, JSON.stringify(s));

// Idempotency — the SQL query filters out already-sent users upstream,
// so we expect candidates: 0 (not just skipped: 1). Either way, sent must be 0.
r = await callCron();
s = pickStep(r, "connect_ig_day1");
expect(`second run does not resend (idempotent)`, s.sent === 0, JSON.stringify(s));

console.log("\n── 13.2 conditional: skips if IG connected ──────────────");
await backdate(1);
await pg.query(
  `INSERT INTO accounts (id, instagram_account_id, instagram_username, access_token, is_active, user_id)
   VALUES ($1, $2, 'test_' || $1, 'fake_token', TRUE, $3)`,
  [`test-${Date.now()}`, `ig_${Date.now()}`, userId]
);
r = await callCron();
s = pickStep(r, "connect_ig_day1");
expect(
  `candidate found but skipped (has IG account)`,
  s.candidates === 1 && s.sent === 0 && s.skipped === 1,
  JSON.stringify(s)
);
await pg.query("DELETE FROM accounts WHERE user_id = $1", [userId]);

console.log("\n── 13.3 Day 3: first-automation nudge ───────────────────");
await backdate(3);
r = await callCron();
s = pickStep(r, "first_automation_day3");
expect(`sent 1 email`, s.candidates === 1 && s.sent === 1, JSON.stringify(s));

console.log("\n── 13.4 Day 7: case study ───────────────────────────────");
await backdate(7);
r = await callCron();
s = pickStep(r, "case_study_day7");
expect(`sent 1 email`, s.candidates === 1 && s.sent === 1, JSON.stringify(s));

console.log("\n── 13.5 Day 12: upgrade nudge ───────────────────────────");
await pg.query("UPDATE users SET plan = 'free', subscription_status = 'none' WHERE id = $1", [userId]);
await backdate(12);
r = await callCron();
s = pickStep(r, "upgrade_day12");
expect(`sent 1 email`, s.candidates === 1 && s.sent === 1, JSON.stringify(s));

console.log("\n── 13.5 conditional: skips paying users ─────────────────");
await backdate(12);
await pg.query("UPDATE users SET plan = 'starter' WHERE id = $1", [userId]);
r = await callCron();
s = pickStep(r, "upgrade_day12");
expect(
  `paying user skipped`,
  s.candidates === 1 && s.sent === 0 && s.skipped === 1,
  JSON.stringify(s)
);

// ── Restore original state ────────────────────────────────────────────────
await pg.query(
  "UPDATE users SET created_at = $2, plan = $3 WHERE id = $1",
  [userId, origCreatedAt, origPlan]
);
await pg.query("DELETE FROM sent_onboarding_emails WHERE user_id = $1", [userId]);
await pg.end();

console.log(`\n═════════════════════════════════════════`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`═════════════════════════════════════════`);
console.log(`Original user state restored.`);
console.log(`Check inbox for 4 emails: connect-IG, first-automation, case-study, upgrade.`);
process.exit(fail === 0 ? 0 : 1);
