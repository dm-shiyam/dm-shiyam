#!/usr/bin/env node
/**
 * Rigorous test suite for DM dedup + per-post rate limit.
 *
 * Tests the ACTUAL SQL statement claimDmSend runs against a real Postgres
 * connection pool, with real concurrent connections to expose races.
 *
 * Run:  node scripts/test-dedup-rate-limit.mjs
 * Env:  DATABASE_URL (falls back to postgres://localhost/dmshiyam)
 */

import pg from "pg";
import crypto from "crypto";

const CONN =
  process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  "postgres://localhost/dmshiyam";
const CAP = 3; // must match production default in claimDmSend

const pool = new pg.Pool({ connectionString: CONN, max: 50 });
const AUTOMATION_ID = "test-auto-" + Date.now();

let passed = 0;
let failed = 0;
const failures = [];

const c = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", b: "\x1b[36m", x: "\x1b[0m" };
const log = {
  h: (m) => console.log(`\n${c.b}━━ ${m} ${c.x}`),
  ok: (m) => { passed++; console.log(`  ${c.g}✓${c.x} ${m}`); },
  fail: (m, exp, got) => {
    failed++;
    failures.push(`${m}: expected ${exp}, got ${got}`);
    console.log(`  ${c.r}✗${c.x} ${m}: expected ${c.g}${exp}${c.x}, got ${c.r}${got}${c.x}`);
  },
};

const uuid = () => crypto.randomUUID();

/**
 * Replicates the EXACT logic from src/lib/db.ts::claimDmSend, including the
 * advisory lock inside a transaction. Each call uses its own client so we
 * can simulate concurrent independent connections.
 */
async function claimDmSend(client, commentId, mediaId, userId, cap = CAP) {
  const id = uuid();
  await client.query("BEGIN");
  try {
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtext('dm-claim:' || $1 || ':' || $2 || ':' || $3)::bigint
       )`,
      [AUTOMATION_ID, mediaId, userId]
    );
    const ins = await client.query(
      `INSERT INTO sent_dms (id, automation_id, comment_id, media_id, instagram_user_id)
       SELECT $1::text, $2::text, $3::text, $4::text, $5::text
       WHERE (
         SELECT COUNT(*) FROM sent_dms
         WHERE automation_id = $2 AND media_id = $4 AND instagram_user_id = $5
       ) < $6
       ON CONFLICT (automation_id, comment_id) DO NOTHING`,
      [id, AUTOMATION_ID, commentId, mediaId, userId, cap]
    );
    if (ins.rowCount > 0) {
      await client.query("COMMIT");
      return { claimed: true };
    }
    const dup = await client.query(
      `SELECT 1 FROM sent_dms WHERE automation_id = $1 AND comment_id = $2 LIMIT 1`,
      [AUTOMATION_ID, commentId]
    );
    await client.query("COMMIT");
    return { claimed: false, reason: dup.rowCount > 0 ? "duplicate" : "rate_limited" };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

async function claimReply(client, commentId) {
  const ins = await client.query(
    `INSERT INTO sent_replies (comment_id, automation_id) VALUES ($1, $2)
     ON CONFLICT (comment_id) DO NOTHING`,
    [commentId, AUTOMATION_ID]
  );
  return ins.rowCount > 0;
}

async function cleanup() {
  await pool.query("DELETE FROM sent_dms WHERE automation_id = $1", [AUTOMATION_ID]);
  await pool.query("DELETE FROM sent_replies WHERE automation_id = $1", [AUTOMATION_ID]);
  await pool.query("DELETE FROM automations WHERE id = $1", [AUTOMATION_ID]);
}

async function setup() {
  await pool.query(
    `INSERT INTO automations (id, name, trigger_keywords, dm_message, reply_comment)
     VALUES ($1, 'Test', 'info', 'DM msg', 'Reply msg')
     ON CONFLICT (id) DO NOTHING`,
    [AUTOMATION_ID]
  );
}

/**
 * Runs N tasks concurrently with a dedicated pooled client per task
 * (real concurrency, not cooperative). Returns array of results.
 */
async function parallel(n, taskFn) {
  const tasks = [];
  for (let i = 0; i < n; i++) {
    tasks.push(
      (async () => {
        const client = await pool.connect();
        try {
          return await taskFn(client, i);
        } finally {
          client.release();
        }
      })()
    );
  }
  return Promise.all(tasks);
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function test1_basicDedup() {
  log.h("Test 1: Basic dedup — same comment, sequential");
  await cleanup(); await setup();
  const client = await pool.connect();
  try {
    const r1 = await claimDmSend(client, "c1", "m1", "u1");
    const r2 = await claimDmSend(client, "c1", "m1", "u1");
    r1.claimed ? log.ok("First attempt claimed") : log.fail("First attempt claimed", true, false);
    !r2.claimed && r2.reason === "duplicate"
      ? log.ok("Second attempt = duplicate")
      : log.fail("Second attempt duplicate reason", "duplicate", r2.reason);
  } finally { client.release(); }
}

async function test2_perPostRateLimit() {
  log.h("Test 2: Per-post cap of 3 — sequential");
  await cleanup(); await setup();
  const client = await pool.connect();
  try {
    const results = [];
    for (let i = 1; i <= 5; i++) {
      results.push(await claimDmSend(client, `c${i}`, "post-A", "user-X"));
    }
    const claimed = results.filter((r) => r.claimed).length;
    const rateLimited = results.filter((r) => r.reason === "rate_limited").length;
    claimed === 3 ? log.ok("Exactly 3 claimed") : log.fail("Claimed count", 3, claimed);
    rateLimited === 2 ? log.ok("Exactly 2 rate-limited") : log.fail("Rate-limited count", 2, rateLimited);
  } finally { client.release(); }
}

async function test3_freshBudgetPerPost() {
  log.h("Test 3: Fresh budget on new post");
  await cleanup(); await setup();
  const client = await pool.connect();
  try {
    for (let i = 1; i <= 4; i++) await claimDmSend(client, `A${i}`, "post-A", "user-Y");
    for (let i = 1; i <= 4; i++) await claimDmSend(client, `B${i}`, "post-B", "user-Y");
    const { rows } = await client.query(
      "SELECT media_id, COUNT(*) FROM sent_dms WHERE automation_id = $1 GROUP BY media_id ORDER BY media_id",
      [AUTOMATION_ID]
    );
    rows[0]?.count === "3"
      ? log.ok("Post A: 3 DMs")
      : log.fail("Post A count", 3, rows[0]?.count);
    rows[1]?.count === "3"
      ? log.ok("Post B: 3 DMs (fresh budget)")
      : log.fail("Post B count", 3, rows[1]?.count);
  } finally { client.release(); }
}

async function test4_multiUserIndependent() {
  log.h("Test 4: Multi-user — each user gets own budget");
  await cleanup(); await setup();
  const client = await pool.connect();
  try {
    for (let u = 1; u <= 10; u++) {
      for (let c = 1; c <= 5; c++) {
        await claimDmSend(client, `u${u}-c${c}`, "post-shared", `user-${u}`);
      }
    }
    const { rows } = await client.query(
      "SELECT COUNT(*) FROM sent_dms WHERE automation_id = $1",
      [AUTOMATION_ID]
    );
    rows[0].count === "30"
      ? log.ok("10 users × 3 cap = 30 DMs")
      : log.fail("Total DMs", 30, rows[0].count);
  } finally { client.release(); }
}

async function test5_concurrentSameComment() {
  log.h("Test 5: CONCURRENT — 100 parallel attempts on same comment_id");
  await cleanup(); await setup();
  const results = await parallel(100, (client) =>
    claimDmSend(client, "concurrent-c1", "post-Z", "user-Z")
  );
  const claimed = results.filter((r) => r.claimed).length;
  const duplicate = results.filter((r) => r.reason === "duplicate").length;
  claimed === 1
    ? log.ok(`Exactly 1 of 100 concurrent claims won (races: ${duplicate})`)
    : log.fail("Concurrent same-comment claims", 1, claimed);
}

async function test6_concurrentRateLimit() {
  log.h("Test 6: CONCURRENT — 50 parallel unique comments, same user+post, cap 3");
  await cleanup(); await setup();
  const results = await parallel(50, (client, i) =>
    claimDmSend(client, `race-c-${i}`, "post-race", "user-race")
  );
  const claimed = results.filter((r) => r.claimed).length;
  const rateLimited = results.filter((r) => r.reason === "rate_limited").length;
  // With advisory lock, cap MUST be exactly CAP — no overshoot tolerated.
  claimed === CAP
    ? log.ok(`Claimed exactly ${CAP} of 50 concurrent (advisory lock enforced)`)
    : log.fail("Concurrent claims exactly = cap", CAP, claimed);
  claimed + rateLimited === 50
    ? log.ok(`All 50 accounted for: ${claimed} claimed + ${rateLimited} rate-limited`)
    : log.fail("Sum = 50", 50, claimed + rateLimited);
  const { rows } = await pool.query(
    "SELECT COUNT(*) FROM sent_dms WHERE automation_id = $1",
    [AUTOMATION_ID]
  );
  parseInt(rows[0].count) === CAP
    ? log.ok(`DB row count = cap (${CAP})`)
    : log.fail("DB row count = cap", CAP, rows[0].count);
}

async function test7_replyDedup() {
  log.h("Test 7: CONCURRENT — 100 parallel reply attempts on same comment");
  await cleanup(); await setup();
  const results = await parallel(100, (client) =>
    claimReply(client, "reply-c1")
  );
  const wins = results.filter(Boolean).length;
  wins === 1
    ? log.ok("Exactly 1 reply claim won (99 blocked by ON CONFLICT)")
    : log.fail("Concurrent reply claims", 1, wins);
}

async function test8_replyIndependenceAcrossComments() {
  log.h("Test 8: 20 different comments, 5 parallel replies each — 20 replies total");
  await cleanup(); await setup();
  const tasks = [];
  for (let c = 1; c <= 20; c++) {
    for (let attempt = 0; attempt < 5; attempt++) {
      tasks.push(
        (async () => {
          const client = await pool.connect();
          try { return await claimReply(client, `indep-c${c}`); }
          finally { client.release(); }
        })()
      );
    }
  }
  const results = await Promise.all(tasks);
  const wins = results.filter(Boolean).length;
  wins === 20
    ? log.ok("Exactly 20 wins (1 per unique comment)")
    : log.fail("Independent reply wins", 20, wins);
}

async function test9_releaseThenReclaimWorks() {
  log.h("Test 9: releaseDmClaim allows re-trigger");
  await cleanup(); await setup();
  const client = await pool.connect();
  try {
    const r1 = await claimDmSend(client, "rel-c1", "post-rel", "user-rel");
    r1.claimed ? log.ok("Initial claim wins") : log.fail("Initial claim", true, false);
    // Simulate the plan-limit rollback
    await client.query(
      "DELETE FROM sent_dms WHERE automation_id = $1 AND comment_id = $2",
      [AUTOMATION_ID, "rel-c1"]
    );
    const r2 = await claimDmSend(client, "rel-c1", "post-rel", "user-rel");
    r2.claimed
      ? log.ok("Re-claim after release wins")
      : log.fail("Re-claim after release", true, r2.claimed);
  } finally { client.release(); }
}

async function test10_capNotReachedAfterRelease() {
  log.h("Test 10: Release does NOT permanently reduce the cap");
  await cleanup(); await setup();
  const client = await pool.connect();
  try {
    // Claim 3, release 1 (simulating plan-limit rollback), then verify user
    // can still get 1 more DM (not 0) because the released row is gone.
    await claimDmSend(client, "cap1", "post-cap", "user-cap");
    await claimDmSend(client, "cap2", "post-cap", "user-cap");
    await claimDmSend(client, "cap3", "post-cap", "user-cap");
    await client.query(
      "DELETE FROM sent_dms WHERE automation_id = $1 AND comment_id = $2",
      [AUTOMATION_ID, "cap2"]
    );
    // Now count is 2, cap is 3 → next distinct comment should succeed
    const r = await claimDmSend(client, "cap4", "post-cap", "user-cap");
    r.claimed
      ? log.ok("New claim after release succeeds (cap respects current count)")
      : log.fail("Post-release claim", true, r.claimed);
  } finally { client.release(); }
}

async function test11_missingFieldsFail() {
  log.h("Test 11: Defensive — verify webhook guard blocks missing IDs");
  // This is a code-level assertion, not SQL. We check the webhook route file
  // does have the guard. String-search is enough here.
  const fs = await import("fs");
  const src = fs.readFileSync("src/app/api/webhook/instagram/route.ts", "utf-8");
  src.includes("!commentId || !mediaId")
    ? log.ok("Webhook has guard: `!commentId || !mediaId` skip")
    : log.fail("Webhook missing-field guard", "present", "absent");
}

async function test12_realWorldScenario() {
  log.h("Test 12: End-to-end scenario — Ankit's actual use case");
  await cleanup(); await setup();
  const client = await pool.connect();
  try {
    // Ankit posts 3 comments on Post A over time
    const posts = ["postA", "postA", "postA", "postA", "postA"]; // 5 comments same post
    const dms = [];
    const replies = [];
    for (let i = 0; i < 5; i++) {
      const commentId = `ankit-A-c${i}`;
      const dm = await claimDmSend(client, commentId, posts[i], "ankit");
      const reply = await claimReply(client, commentId);
      dms.push(dm);
      replies.push(reply);
    }
    const dmsSent = dms.filter((d) => d.claimed).length;
    const repliesSent = replies.filter(Boolean).length;
    dmsSent === 3
      ? log.ok(`Ankit: 5 comments → ${dmsSent} DMs (cap enforced)`)
      : log.fail("Ankit DM count", 3, dmsSent);
    repliesSent === 5
      ? log.ok(`Ankit: 5 comments → ${repliesSent} replies (all comments engaged)`)
      : log.fail("Ankit reply count", 5, repliesSent);

    // Now Ankit comments on Post B — fresh budget
    for (let i = 0; i < 3; i++) {
      const dm = await claimDmSend(client, `ankit-B-c${i}`, "postB", "ankit");
      dms.push(dm);
    }
    const dmsSentB = dms.slice(5).filter((d) => d.claimed).length;
    dmsSentB === 3
      ? log.ok(`Ankit: 3 comments on new Post B → 3 DMs (fresh budget)`)
      : log.fail("Ankit Post B DM count", 3, dmsSentB);
  } finally { client.release(); }
}

async function test13_metaRetryStorm() {
  log.h("Test 13: Meta retry storm — same webhook 200x concurrently");
  await cleanup(); await setup();
  const results = await parallel(200, (client) =>
    claimDmSend(client, "storm-c1", "post-storm", "user-storm")
  );
  const claimed = results.filter((r) => r.claimed).length;
  const dup = results.filter((r) => r.reason === "duplicate").length;
  claimed === 1
    ? log.ok(`Retry storm: 1 of 200 concurrent claims won, ${dup} deduped`)
    : log.fail("Retry storm claims", 1, claimed);
}

async function test14_mixedStorm() {
  log.h("Test 14: Chaotic storm — 200 mixed parallel requests");
  await cleanup(); await setup();
  const users = ["u1", "u2", "u3", "u4"];
  const posts = ["p1", "p2"];
  const tasks = [];
  for (let i = 0; i < 200; i++) {
    const user = users[i % users.length];
    const post = posts[i % posts.length];
    // Comments are pseudo-unique with retries for some
    const commentId = i % 5 === 0 ? `retry-${user}-${post}` : `c-${i}`;
    tasks.push(
      (async () => {
        const client = await pool.connect();
        try { return await claimDmSend(client, commentId, post, user); }
        finally { client.release(); }
      })()
    );
  }
  const results = await Promise.all(tasks);
  const claimed = results.filter((r) => r.claimed).length;
  const dup = results.filter((r) => r.reason === "duplicate").length;
  const rl = results.filter((r) => r.reason === "rate_limited").length;

  // Verify no user exceeded cap on any post (with acceptable race overshoot)
  const { rows } = await pool.query(
    `SELECT instagram_user_id, media_id, COUNT(*) as n FROM sent_dms
     WHERE automation_id = $1 GROUP BY 1, 2 ORDER BY n DESC LIMIT 1`,
    [AUTOMATION_ID]
  );
  const maxPerPair = parseInt(rows[0]?.n || "0");
  maxPerPair <= CAP
    ? log.ok(`Max DMs per (user,post) = ${maxPerPair} — cap strictly enforced under 200 concurrent`)
    : log.fail("Max per (user,post) ≤ cap", `≤${CAP}`, maxPerPair);
  console.log(`    stats: ${claimed} claimed, ${dup} duplicate, ${rl} rate_limited`);
}

async function test15_verifyDbIntegrity() {
  log.h("Test 15: DB integrity — unique constraint holds");
  await cleanup(); await setup();
  // Manually try to insert duplicate comment_id — must fail
  const client = await pool.connect();
  try {
    await client.query(
      "INSERT INTO sent_dms (id, automation_id, comment_id, media_id, instagram_user_id) VALUES ($1, $2, $3, $4, $5)",
      [uuid(), AUTOMATION_ID, "unique-c1", "m1", "u1"]
    );
    let threw = false;
    try {
      await client.query(
        "INSERT INTO sent_dms (id, automation_id, comment_id, media_id, instagram_user_id) VALUES ($1, $2, $3, $4, $5)",
        [uuid(), AUTOMATION_ID, "unique-c1", "m1", "u2"]
      );
    } catch (e) {
      threw = e.code === "23505"; // unique_violation
    }
    threw
      ? log.ok("Duplicate (automation_id, comment_id) rejected by UNIQUE constraint")
      : log.fail("Unique constraint enforcement", "23505 unique_violation", "no error");
  } finally { client.release(); }
}

// ═══════════════════════════════════════════════════════════════════════════

async function run() {
  console.log(`${c.b}Rigorous test suite for DM dedup + per-post rate limit${c.x}`);
  console.log(`DB: ${CONN.replace(/:[^:@]*@/, ":***@")}`);
  console.log(`Cap: ${CAP} DMs per (recipient × post)\n`);

  try {
    await test1_basicDedup();
    await test2_perPostRateLimit();
    await test3_freshBudgetPerPost();
    await test4_multiUserIndependent();
    await test5_concurrentSameComment();
    await test6_concurrentRateLimit();
    await test7_replyDedup();
    await test8_replyIndependenceAcrossComments();
    await test9_releaseThenReclaimWorks();
    await test10_capNotReachedAfterRelease();
    await test11_missingFieldsFail();
    await test12_realWorldScenario();
    await test13_metaRetryStorm();
    await test14_mixedStorm();
    await test15_verifyDbIntegrity();
  } finally {
    await cleanup();
    await pool.end();
  }

  const total = passed + failed;
  console.log(`\n${c.b}━━ Results ━━${c.x}`);
  console.log(`  ${c.g}Passed: ${passed}/${total}${c.x}`);
  if (failed > 0) {
    console.log(`  ${c.r}Failed: ${failed}/${total}${c.x}`);
    failures.forEach((f) => console.log(`    ${c.r}✗${c.x} ${f}`));
    process.exit(1);
  } else {
    console.log(`  ${c.g}All tests passed ✅${c.x}\n`);
    process.exit(0);
  }
}

run().catch((err) => {
  console.error(`\n${c.r}Fatal error:${c.x}`, err);
  process.exit(2);
});
