/**
 * One-time migration: SQLite (dm-shiyam.db) → Postgres
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx ts-node --project tsconfig.json scripts/migrate-sqlite-to-pg.ts
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING on every insert.
 */

import Database from "better-sqlite3";
import { Pool } from "pg";
import path from "path";
import * as fs from "fs";

// ── Config ────────────────────────────────────────────────────────────────────

const SQLITE_PATH = path.join(process.cwd(), "dm-shiyam.db");
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set.");
  process.exit(1);
}
if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`❌  SQLite file not found at ${SQLITE_PATH}`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pg = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

function rows<T = Record<string, unknown>>(sql: string): T[] {
  return sqlite.prepare(sql).all() as T[];
}

// SQLite stores booleans as 0/1 integers — convert to JS booleans for pg
function bool(v: unknown): boolean {
  return v === 1 || v === true || v === "1";
}

// SQLite stores datetimes as "YYYY-MM-DD HH:MM:SS" — append Z for UTC ISO
function ts(v: unknown): string | null {
  if (!v || v === "null") return null;
  const s = String(v).trim();
  // Already ISO with offset
  if (s.includes("T") || s.includes("+") || s.endsWith("Z")) return s;
  // SQLite format → ISO
  return s.replace(" ", "T") + "Z";
}

async function insertBatch(
  tableName: string,
  records: Record<string, unknown>[],
  conflictKey: string
) {
  if (records.length === 0) {
    console.log(`  ⏭  ${tableName}: no rows`);
    return;
  }

  const client = await pg.connect();
  try {
    await client.query("BEGIN");
    let inserted = 0;

    for (const rec of records) {
      const keys = Object.keys(rec);
      const cols = keys.join(", ");
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const vals = keys.map((k) => rec[k]);

      await client.query(
        `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders})
         ON CONFLICT (${conflictKey}) DO NOTHING`,
        vals
      );
      inserted++;
    }

    await client.query("COMMIT");
    console.log(`  ✅  ${tableName}: ${inserted} rows processed`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ── Migration ─────────────────────────────────────────────────────────────────

async function migrate() {
  console.log("\n🚀  Starting SQLite → Postgres migration\n");

  // 1. Users
  const users = rows<Record<string, unknown>>("SELECT * FROM users").map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    password_hash: r.password_hash ?? null,
    provider: r.provider ?? "credentials",
    provider_id: r.provider_id ?? null,
    plan: r.plan ?? "free",
    razorpay_customer_id: r.razorpay_customer_id ?? null,
    razorpay_subscription_id: r.razorpay_subscription_id ?? null,
    subscription_status: r.subscription_status ?? "none",
    dm_limit: Number(r.dm_limit ?? 100),
    dms_used_this_month: Number(r.dms_used_this_month ?? 0),
    reset_token: r.reset_token ?? null,
    reset_token_expires: ts(r.reset_token_expires),
    has_seen_onboarding: bool(r.has_seen_onboarding),
    role: r.role ?? "user",
    created_at: ts(r.created_at) ?? new Date().toISOString(),
    updated_at: ts(r.updated_at) ?? new Date().toISOString(),
  }));
  await insertBatch("users", users, "id");

  // 2. Accounts
  const accounts = rows<Record<string, unknown>>("SELECT * FROM accounts").map((r) => ({
    id: r.id,
    instagram_account_id: r.instagram_account_id,
    instagram_username: r.instagram_username,
    access_token: r.access_token,
    page_id: r.page_id ?? null,
    is_active: bool(r.is_active ?? 1),
    token_expires_at: ts(r.token_expires_at),
    user_id: r.user_id ?? null,
    created_at: ts(r.created_at) ?? new Date().toISOString(),
    updated_at: ts(r.updated_at) ?? new Date().toISOString(),
  }));
  await insertBatch("accounts", accounts, "id");

  // 3. Automations
  const automations = rows<Record<string, unknown>>("SELECT * FROM automations").map((r) => ({
    id: r.id,
    account_id: r.account_id ?? null,
    user_id: r.user_id ?? null,
    name: r.name,
    trigger_keywords: r.trigger_keywords,
    dm_message: r.dm_message,
    reply_comment: r.reply_comment ?? null,
    ai_enabled: bool(r.ai_enabled),
    ai_system_prompt: r.ai_system_prompt ?? null,
    is_active: bool(r.is_active ?? 1),
    total_triggered: Number(r.total_triggered ?? 0),
    schedule_enabled: bool(r.schedule_enabled),
    schedule_start_hour: Number(r.schedule_start_hour ?? 0),
    schedule_end_hour: Number(r.schedule_end_hour ?? 23),
    schedule_days: r.schedule_days ?? "0,1,2,3,4,5,6",
    created_at: ts(r.created_at) ?? new Date().toISOString(),
    updated_at: ts(r.updated_at) ?? new Date().toISOString(),
  }));
  await insertBatch("automations", automations, "id");

  // 4. Activity Log
  const activity = rows<Record<string, unknown>>("SELECT * FROM activity_log").map((r) => ({
    id: r.id,
    account_id: r.account_id ?? null,
    automation_id: r.automation_id,
    automation_name: r.automation_name,
    user_id: r.user_id ?? null,
    instagram_user_id: r.instagram_user_id,
    instagram_username: r.instagram_username,
    comment_text: r.comment_text,
    matched_keyword: r.matched_keyword,
    dm_sent: bool(r.dm_sent),
    comment_replied: bool(r.comment_replied),
    ai_generated: bool(r.ai_generated),
    error_message: r.error_message ?? null,
    created_at: ts(r.created_at) ?? new Date().toISOString(),
  }));
  await insertBatch("activity_log", activity, "id");

  // 5. Sent DMs
  const sentDms = rows<Record<string, unknown>>("SELECT * FROM sent_dms").map((r) => ({
    id: r.id,
    automation_id: r.automation_id,
    instagram_user_id: r.instagram_user_id,
    sent_at: ts(r.sent_at) ?? new Date().toISOString(),
  }));
  await insertBatch("sent_dms", sentDms, "id");

  // 6. Webhook health (single row)
  const health = rows<Record<string, unknown>>(
    "SELECT * FROM webhook_health WHERE id = 1"
  );
  if (health.length > 0) {
    const r = health[0];
    await pg.query(
      `INSERT INTO webhook_health (id, last_received_at, last_event_type, total_received)
       VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE
         SET last_received_at = EXCLUDED.last_received_at,
             last_event_type  = EXCLUDED.last_event_type,
             total_received   = EXCLUDED.total_received`,
      [ts(r.last_received_at), r.last_event_type ?? null, Number(r.total_received ?? 0)]
    );
    console.log("  ✅  webhook_health: synced");
  }

  await pg.end();
  sqlite.close();
  console.log("\n✅  Migration complete!\n");
}

migrate().catch((err) => {
  console.error("\n❌  Migration failed:", err);
  process.exit(1);
});