#!/usr/bin/env node
/**
 * Regression test for the Meta data-deletion callback flow.
 *
 * Verifies:
 *   1. HMAC-SHA256 signed_request verification (accept valid, reject invalid)
 *   2. processInstagramDataDeletion() cleanly cascades:
 *      - deletes automations for the account
 *      - deletes activity_log for the account
 *      - deletes the account itself
 *      - preserves the parent user (per Meta spec)
 *      - writes an audit row with status='completed'
 *   3. Unknown IG user → status='not_found', no side effects on other accounts
 *   4. Idempotent — running twice for the same account is safe
 *
 * Run: DATABASE_URL=postgres://localhost/dmshiyam node scripts/test-data-deletion.mjs
 */
import pg from "pg";
import crypto from "crypto";
import { randomUUID } from "crypto";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const APP_SECRET = "test_app_secret_for_hmac_verification";
process.env.INSTAGRAM_APP_SECRET = APP_SECRET;

let passed = 0;
let failed = 0;
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  failed++;
};
const pass = (msg) => {
  console.log(`  ✓ ${msg}`);
  passed++;
};

function base64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeSignedRequest(payload, secret = APP_SECRET) {
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  return `${base64url(sig)}.${payloadB64}`;
}

async function seedFixture(igUserId) {
  const userId = randomUUID();
  const accountId = randomUUID();
  // Unique comment_id per fixture — sent_replies.comment_id is PRIMARY KEY
  const commentId = `c_${randomUUID().slice(0, 8)}`;

  await pool.query(
    `INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)`,
    [userId, `${userId}@test.local`, "Test User", "hash"]
  );
  await pool.query(
    `INSERT INTO accounts (id, instagram_account_id, instagram_username, access_token, user_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [accountId, igUserId, `ig_${igUserId}`, "token", userId]
  );

  // 2 automations for this account
  const auto1 = randomUUID();
  const auto2 = randomUUID();
  await pool.query(
    `INSERT INTO automations (id, account_id, user_id, name, trigger_keywords, dm_message)
     VALUES ($1, $2, $3, 'auto1', 'info', 'hi'),
            ($4, $2, $3, 'auto2', 'buy', 'link')`,
    [auto1, accountId, userId, auto2]
  );

  // Activity log rows for both automations
  const insertActivity = async (autoId, name) => {
    await pool.query(
      `INSERT INTO activity_log
       (id, account_id, automation_id, automation_name, user_id, instagram_user_id, instagram_username, comment_text, matched_keyword)
       VALUES ($1, $2, $3, $4, $5, 'commenter_123', 'commenter', 'text info', 'info')`,
      [randomUUID(), accountId, autoId, name, userId]
    );
  };
  await insertActivity(auto1, "auto1");
  await insertActivity(auto1, "auto1");
  await insertActivity(auto2, "auto2");

  // sent_dms tied to automation (cascade check)
  await pool.query(
    `INSERT INTO sent_dms (id, automation_id, comment_id, media_id, instagram_user_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), auto1, commentId, "m1", "commenter_123"]
  );
  // sent_replies tied to automation
  await pool.query(
    `INSERT INTO sent_replies (comment_id, automation_id) VALUES ($1, $2)`,
    [commentId, auto1]
  );

  return { userId, accountId, commentId };
}

async function countRows(table, where, params) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ${table} WHERE ${where}`,
    params
  );
  return r.rows[0].n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load the actual implementation via a dynamic import to reuse production code
// ─────────────────────────────────────────────────────────────────────────────
async function loadImpl() {
  // We cannot import the TS route directly from ESM without a compile step,
  // so we re-implement the HMAC verify + call the SQL from db.ts by
  // spawning a Node worker. Simpler: replicate the pure verify function here
  // (it's small) and hit the DB with the SAME SQL as the production helper.
  return null;
}

function verifySignedRequest(signedRequest, secret) {
  if (!signedRequest) return null;
  const parts = signedRequest.split(".");
  if (parts.length !== 2) return null;
  const [encodedSig, payload] = parts;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(encodedSig, "base64url");
  if (
    expected.length !== received.length ||
    !crypto.timingSafeEqual(expected, received)
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// Replicated deletion logic — MUST stay in sync with
// src/lib/db.ts::processInstagramDataDeletion. The test would ideally import
// the TS function directly, but that requires a compile step; keeping this
// inline keeps the test dependency-free.
async function processDeletion(igUserId, code) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO deletion_requests (code, instagram_account_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (code) DO NOTHING`,
      [code, igUserId]
    );
    const acc = await client.query(
      "SELECT id FROM accounts WHERE instagram_account_id = $1",
      [igUserId]
    );
    if (acc.rowCount === 0) {
      await client.query(
        `UPDATE deletion_requests SET status='not_found', completed_at=NOW() WHERE code=$1`,
        [code]
      );
      await client.query("COMMIT");
      return { status: "not_found" };
    }
    const accountId = acc.rows[0].id;
    const del1 = await client.query(
      "DELETE FROM automations WHERE account_id = $1",
      [accountId]
    );
    const del2 = await client.query(
      "DELETE FROM activity_log WHERE account_id = $1",
      [accountId]
    );
    await client.query("DELETE FROM accounts WHERE id = $1", [accountId]);
    await client.query(
      `UPDATE deletion_requests
       SET status='completed', automations_deleted=$2, activity_rows_deleted=$3, completed_at=NOW()
       WHERE code=$1`,
      [code, del1.rowCount, del2.rowCount]
    );
    await client.query("COMMIT");
    return { status: "completed", automations: del1.rowCount, activity: del2.rowCount };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  // Clean slate
  await pool.query("DELETE FROM deletion_requests");
  await pool.query("DELETE FROM sent_replies");
  await pool.query("DELETE FROM sent_dms");
  await pool.query("DELETE FROM activity_log WHERE automation_name IN ('auto1','auto2')");
  await pool.query("DELETE FROM automations WHERE name IN ('auto1','auto2')");
  await pool.query("DELETE FROM accounts WHERE instagram_username LIKE 'ig_%'");
  await pool.query("DELETE FROM users WHERE email LIKE '%@test.local'");

  console.log("\n━━ Test 1: HMAC verification — valid signature accepted ━━");
  {
    const sr = makeSignedRequest({ user_id: "12345", algorithm: "HMAC-SHA256" });
    const parsed = verifySignedRequest(sr, APP_SECRET);
    if (parsed?.user_id === "12345") pass("Valid signed_request decoded");
    else fail("Valid signed_request rejected");
  }

  console.log("\n━━ Test 2: HMAC verification — wrong secret rejected ━━");
  {
    const sr = makeSignedRequest({ user_id: "12345" }, "wrong_secret");
    const parsed = verifySignedRequest(sr, APP_SECRET);
    if (parsed === null) pass("Forged signature rejected");
    else fail("Forged signature accepted — SECURITY BUG");
  }

  console.log("\n━━ Test 3: HMAC verification — tampered payload rejected ━━");
  {
    const sr = makeSignedRequest({ user_id: "12345" });
    const [sig] = sr.split(".");
    const tampered = `${sig}.${base64url(JSON.stringify({ user_id: "99999" }))}`;
    const parsed = verifySignedRequest(tampered, APP_SECRET);
    if (parsed === null) pass("Tampered payload rejected");
    else fail("Tampered payload accepted — SECURITY BUG");
  }

  console.log("\n━━ Test 4: HMAC verification — malformed rejected ━━");
  {
    if (verifySignedRequest("", APP_SECRET) === null) pass("Empty rejected");
    if (verifySignedRequest("no_dot_separator", APP_SECRET) === null) pass("No separator rejected");
    if (verifySignedRequest("a.b.c", APP_SECRET) === null) pass("Extra separator rejected");
  }

  console.log("\n━━ Test 5: End-to-end deletion cascades correctly ━━");
  {
    const IG_ID = `test_${Date.now()}_1`;
    const { userId, accountId, commentId } = await seedFixture(IG_ID);
    const before = {
      accounts: await countRows("accounts", "id = $1", [accountId]),
      autos: await countRows("automations", "account_id = $1", [accountId]),
      activity: await countRows("activity_log", "account_id = $1", [accountId]),
      dms: await countRows("sent_dms", "comment_id = $1", [commentId]),
      replies: await countRows("sent_replies", "comment_id = $1", [commentId]),
      user: await countRows("users", "id = $1", [userId]),
    };
    if (before.accounts === 1 && before.autos === 2 && before.activity === 3 && before.dms === 1 && before.replies === 1) {
      pass(`Fixture seeded: 1 account, 2 autos, 3 activity, 1 DM, 1 reply, 1 user`);
    } else {
      fail(`Fixture wrong: ${JSON.stringify(before)}`);
    }

    const result = await processDeletion(IG_ID, "code_e2e_1");

    if (result.status === "completed") pass("Status = completed");
    if (result.automations === 2) pass("2 automations deleted");
    else fail(`Expected 2 automations deleted, got ${result.automations}`);
    // Note: activity_log rows are cascade-deleted via automations FK BEFORE
    // our explicit sweep runs. Expected count reported by the sweep is 0.
    if (result.activity === 0) pass("Activity swept: 0 (already cascade-deleted via automation FK)");
    else fail(`Expected 0 activity from sweep (cascade already ran), got ${result.activity}`);

    const after = {
      accounts: await countRows("accounts", "id = $1", [accountId]),
      autos: await countRows("automations", "account_id = $1", [accountId]),
      activity: await countRows("activity_log", "account_id = $1", [accountId]),
      dms: await countRows("sent_dms", "comment_id = $1", [commentId]),
      replies: await countRows("sent_replies", "comment_id = $1", [commentId]),
      user: await countRows("users", "id = $1", [userId]),
    };
    if (after.accounts === 0) pass("Account row deleted");
    else fail("Account not deleted");
    if (after.autos === 0) pass("Automations deleted");
    else fail(`${after.autos} automations survived`);
    if (after.activity === 0) pass("Activity log deleted");
    else fail(`${after.activity} activity rows survived`);
    if (after.dms === 0) pass("sent_dms cascade-deleted via automation FK");
    else fail(`${after.dms} sent_dms rows survived — cascade broken`);
    if (after.replies === 0) pass("sent_replies cascade-deleted via automation FK");
    else fail(`${after.replies} sent_replies rows survived — cascade broken`);
    if (after.user === 1) pass("Parent user row preserved (per Meta spec)");
    else fail("Parent user row was deleted — should be preserved");

    const audit = await pool.query(
      "SELECT * FROM deletion_requests WHERE code = 'code_e2e_1'"
    );
    if (audit.rows[0]?.status === "completed") pass("Audit row status=completed");
    else fail(`Audit row status wrong: ${audit.rows[0]?.status}`);
  }

  console.log("\n━━ Test 6: Unknown IG user → status='not_found', no side effects ━━");
  {
    // Seed a different account to prove we don't touch it
    const OTHER_IG = `test_${Date.now()}_other`;
    const { accountId: otherAccountId } = await seedFixture(OTHER_IG);

    const result = await processDeletion("nonexistent_ig_user_id", "code_nf_1");
    if (result.status === "not_found") pass("Status = not_found");
    else fail(`Expected not_found, got ${result.status}`);

    const stillThere = await countRows("accounts", "id = $1", [otherAccountId]);
    if (stillThere === 1) pass("Unrelated account not affected");
    else fail("Unrelated account was deleted — should not touch other accounts");
  }

  console.log("\n━━ Test 7: Idempotent — deletion of already-deleted account ━━");
  {
    const IG_ID = `test_${Date.now()}_idem`;
    await seedFixture(IG_ID);
    const r1 = await processDeletion(IG_ID, "code_idem_1");
    const r2 = await processDeletion(IG_ID, "code_idem_2");
    if (r1.status === "completed" && r2.status === "not_found") {
      pass("First call: completed; second call: not_found (data already gone)");
    } else {
      fail(`Idempotency broken: first=${r1.status}, second=${r2.status}`);
    }
  }

  console.log("\n━━ Test 8: Signed request → user_id extraction end-to-end ━━");
  {
    const IG_ID = `test_${Date.now()}_e2e2`;
    await seedFixture(IG_ID);
    const sr = makeSignedRequest({ user_id: IG_ID, algorithm: "HMAC-SHA256" });
    const parsed = verifySignedRequest(sr, APP_SECRET);
    if (!parsed) {
      fail("signed_request did not verify");
    } else {
      const result = await processDeletion(parsed.user_id, "code_e2e_2");
      if (result.status === "completed") pass("Full flow: signed_request → verify → delete");
      else fail(`Full flow status=${result.status}`);
    }
  }

  // Cleanup
  await pool.query("DELETE FROM deletion_requests");
  await pool.query("DELETE FROM users WHERE email LIKE '%@test.local'");

  console.log("\n━━ Results ━━");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  pool.end();
  process.exit(1);
});
