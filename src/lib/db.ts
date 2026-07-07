import Database from "better-sqlite3";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Account, Automation, ActivityLog, DashboardStats, AnalyticsData, User } from "@/types";

const DB_PATH = path.join(process.cwd(), "dm-shiyam.db");

let _db: Database.Database | null = null;


function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initTables(_db);
  }
  return _db;
}

function initTables(db: Database.Database) {
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
      updated_at TEXT DEFAULT (datetime('now'))
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
      FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sent_dms (
      id TEXT PRIMARY KEY,
      automation_id TEXT NOT NULL,
      instagram_user_id TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS webhook_health (
      id INTEGER PRIMARY KEY DEFAULT 1,
      last_received_at TEXT,
      last_event_type TEXT,
      total_received INTEGER DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_sent_dms_dedup ON sent_dms(automation_id, instagram_user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_automation ON activity_log(automation_id);
    CREATE INDEX IF NOT EXISTS idx_activity_account ON activity_log(account_id);
    CREATE INDEX IF NOT EXISTS idx_automations_account ON automations(account_id);
  `);

  // Migration: add new columns to existing tables (safe to re-run)
  const migrations = [
    "ALTER TABLE automations ADD COLUMN account_id TEXT",
    "ALTER TABLE automations ADD COLUMN ai_enabled INTEGER DEFAULT 0",
    "ALTER TABLE automations ADD COLUMN ai_system_prompt TEXT",
    "ALTER TABLE activity_log ADD COLUMN account_id TEXT",
    "ALTER TABLE activity_log ADD COLUMN ai_generated INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN reset_token TEXT",
    "ALTER TABLE users ADD COLUMN reset_token_expires TEXT",
    "ALTER TABLE accounts ADD COLUMN token_expires_at TEXT",
    "ALTER TABLE accounts ADD COLUMN user_id TEXT",
    "ALTER TABLE automations ADD COLUMN user_id TEXT",
    "ALTER TABLE activity_log ADD COLUMN user_id TEXT",
    "ALTER TABLE users ADD COLUMN has_seen_onboarding INTEGER DEFAULT 0",
    "CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id)",
    "ALTER TABLE automations ADD COLUMN schedule_enabled INTEGER DEFAULT 0",
    "ALTER TABLE automations ADD COLUMN schedule_start_hour INTEGER DEFAULT 0",
    "ALTER TABLE automations ADD COLUMN schedule_end_hour INTEGER DEFAULT 23",
    "ALTER TABLE automations ADD COLUMN schedule_days TEXT DEFAULT '0,1,2,3,4,5,6'",
    "INSERT OR IGNORE INTO webhook_health (id, total_received) VALUES (1, 0)",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }
}

// ═══════════════════════════════════════
// ── Accounts CRUD ──
// ═══════════════════════════════════════

export function getAllAccounts(userId?: string): Account[] {
  const db = getDb();
  if (userId) {
    return db
      .prepare("SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as Account[];
  }
  return db
    .prepare("SELECT * FROM accounts ORDER BY created_at DESC")
    .all() as Account[];
}

export function getAccount(id: string): Account | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as Account | undefined;
}

export function getAccountByInstagramId(igId: string): Account | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM accounts WHERE instagram_account_id = ?")
    .get(igId) as Account | undefined;
}

export function createAccount(data: {
  instagram_account_id: string;
  instagram_username: string;
  access_token: string;
  page_id?: string;
  token_expires_at?: string | null;
  user_id?: string;
}): Account {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO accounts (id, instagram_account_id, instagram_username, access_token, page_id, token_expires_at, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.instagram_account_id, data.instagram_username, data.access_token, data.page_id || null, data.token_expires_at || null, data.user_id || null);
  return getAccount(id)!;
}

export function updateAccount(
  id: string,
  data: Partial<{ instagram_username: string; access_token: string; page_id: string; is_active: boolean; token_expires_at: string | null }>
): Account | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.instagram_username !== undefined) { fields.push("instagram_username = ?"); values.push(data.instagram_username); }
  if (data.access_token !== undefined) { fields.push("access_token = ?"); values.push(data.access_token); }
  if (data.page_id !== undefined) { fields.push("page_id = ?"); values.push(data.page_id); }
  if (data.is_active !== undefined) { fields.push("is_active = ?"); values.push(data.is_active ? 1 : 0); }
  if (data.token_expires_at !== undefined) { fields.push("token_expires_at = ?"); values.push(data.token_expires_at); }
  if (fields.length === 0) return getAccount(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE accounts SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getAccount(id);
}

export function getAccountsWithExpiringTokens(thresholdDays = 7): Account[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM accounts
     WHERE is_active = 1
       AND token_expires_at IS NOT NULL
       AND token_expires_at <= datetime('now', '+' || ? || ' days')
     ORDER BY token_expires_at ASC`
  ).all(thresholdDays) as Account[];
}

export function deleteAccount(id: string): boolean {
  const db = getDb();
  return db.prepare("DELETE FROM accounts WHERE id = ?").run(id).changes > 0;
}

// ═══════════════════════════════════════
// ── Automations CRUD ──
// ═══════════════════════════════════════

export function getAllAutomations(filters?: { accountId?: string; userId?: string }): Automation[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.accountId) { conditions.push("account_id = ?"); params.push(filters.accountId); }
  if (filters?.userId) { conditions.push("user_id = ?"); params.push(filters.userId); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return db
    .prepare(`SELECT * FROM automations ${where} ORDER BY created_at DESC`)
    .all(...params) as Automation[];
}

export function getAutomation(id: string): Automation | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM automations WHERE id = ?")
    .get(id) as Automation | undefined;
}

export function getActiveAutomations(accountId?: string): Automation[] {
  const db = getDb();
  if (accountId) {
    return db
      .prepare("SELECT * FROM automations WHERE is_active = 1 AND account_id = ?")
      .all(accountId) as Automation[];
  }
  return db
    .prepare("SELECT * FROM automations WHERE is_active = 1")
    .all() as Automation[];
}

export function createAutomation(data: {
  name: string;
  trigger_keywords: string;
  dm_message: string;
  reply_comment?: string;
  account_id?: string;
  ai_enabled?: boolean;
  ai_system_prompt?: string;
  user_id?: string;
}): Automation {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO automations (id, account_id, name, trigger_keywords, dm_message, reply_comment, ai_enabled, ai_system_prompt, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.account_id || null,
    data.name,
    data.trigger_keywords.toLowerCase(),
    data.dm_message,
    data.reply_comment || null,
    data.ai_enabled ? 1 : 0,
    data.ai_system_prompt || null,
    data.user_id || null
  );
  return getAutomation(id)!;
}

export function updateAutomation(
  id: string,
  data: Partial<{
    name: string;
    trigger_keywords: string;
    dm_message: string;
    reply_comment: string;
    is_active: boolean;
    account_id: string;
    ai_enabled: boolean;
    ai_system_prompt: string;
  }>
): Automation | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.trigger_keywords !== undefined) { fields.push("trigger_keywords = ?"); values.push(data.trigger_keywords.toLowerCase()); }
  if (data.dm_message !== undefined) { fields.push("dm_message = ?"); values.push(data.dm_message); }
  if (data.reply_comment !== undefined) { fields.push("reply_comment = ?"); values.push(data.reply_comment); }
  if (data.is_active !== undefined) { fields.push("is_active = ?"); values.push(data.is_active ? 1 : 0); }
  if (data.account_id !== undefined) { fields.push("account_id = ?"); values.push(data.account_id || null); }
  if (data.ai_enabled !== undefined) { fields.push("ai_enabled = ?"); values.push(data.ai_enabled ? 1 : 0); }
  if (data.ai_system_prompt !== undefined) { fields.push("ai_system_prompt = ?"); values.push(data.ai_system_prompt); }

  if (fields.length === 0) return getAutomation(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE automations SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getAutomation(id);
}

export function deleteAutomation(id: string): boolean {
  const db = getDb();
  return db.prepare("DELETE FROM automations WHERE id = ?").run(id).changes > 0;
}

export function incrementTriggerCount(id: string): void {
  const db = getDb();
  db.prepare("UPDATE automations SET total_triggered = total_triggered + 1 WHERE id = ?").run(id);
}

// ═══════════════════════════════════════
// ── Activity Log ──
// ═══════════════════════════════════════

export function logActivity(data: {
  account_id?: string;
  automation_id: string;
  automation_name: string;
  instagram_user_id: string;
  instagram_username: string;
  comment_text: string;
  matched_keyword: string;
  dm_sent: boolean;
  comment_replied: boolean;
  ai_generated?: boolean;
  error_message?: string;
  user_id?: string;
}): ActivityLog {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO activity_log 
     (id, account_id, automation_id, automation_name, instagram_user_id, instagram_username, 
      comment_text, matched_keyword, dm_sent, comment_replied, ai_generated, error_message, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.account_id || null,
    data.automation_id,
    data.automation_name,
    data.instagram_user_id,
    data.instagram_username,
    data.comment_text,
    data.matched_keyword,
    data.dm_sent ? 1 : 0,
    data.comment_replied ? 1 : 0,
    data.ai_generated ? 1 : 0,
    data.error_message || null,
    data.user_id || null
  );
  return db.prepare("SELECT * FROM activity_log WHERE id = ?").get(id) as ActivityLog;
}

export function getActivityLog(limit = 50, offset = 0, filters?: { accountId?: string; userId?: string }): ActivityLog[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.accountId) { conditions.push("account_id = ?"); params.push(filters.accountId); }
  if (filters?.userId) { conditions.push("user_id = ?"); params.push(filters.userId); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);
  return db
    .prepare(`SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params) as ActivityLog[];
}

// ═══════════════════════════════════════
// ── Dashboard Stats ──
// ═══════════════════════════════════════




export function getDashboardStats(userId?: string): DashboardStats {
  const db = getDb();
  const uf = userId ? " AND user_id = ?" : "";
const p = userId ? [userId] : [];

  const q = (sql: string) => (db.prepare(sql).get(...p) as { count: number }).count;

  return {
    total_automations: q(`SELECT COUNT(*) as count FROM automations WHERE 1=1${uf}`),
    active_automations: q(`SELECT COUNT(*) as count FROM automations WHERE is_active = 1${uf}`),
    total_dms_sent: q(`SELECT COUNT(*) as count FROM activity_log WHERE dm_sent = 1${uf}`),
    total_comments_replied: q(`SELECT COUNT(*) as count FROM activity_log WHERE comment_replied = 1${uf}`),
    dms_today: q(`SELECT COUNT(*) as count FROM activity_log WHERE dm_sent = 1 AND date(created_at) = date('now')${uf}`),
    dms_this_week: q(`SELECT COUNT(*) as count FROM activity_log WHERE dm_sent = 1 AND created_at >= datetime('now', '-7 days')${uf}`),
    ai_replies: q(`SELECT COUNT(*) as count FROM activity_log WHERE ai_generated = 1${uf}`),
    accounts_connected: q(`SELECT COUNT(*) as count FROM accounts WHERE is_active = 1${uf}`),
  };
}

// ═══════════════════════════════════════
// ── Analytics ──
// ═══════════════════════════════════════

export function getAnalyticsData(days = 30, userId?: string): AnalyticsData {
  const db = getDb();

  // Sanitize: ensure days is a positive integer (1–365)
  const raw = Number(days);
  const safeDays = Number.isFinite(raw) ? Math.max(1, Math.min(365, Math.floor(raw))) : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - safeDays);
  const cutoffISO = cutoff.toISOString();

  const activityFilter = userId ? " AND activity_log.user_id = ?" : "";
const activityAliasFilter = userId ? " AND a.user_id = ?" : "";
  const base = userId ? [cutoffISO, userId] : [cutoffISO];

  // DMs over time (last N days)
  const dmsOverTime = db.prepare(`
    SELECT date(created_at) as date,
           COUNT(*) as count,
           SUM(CASE WHEN ai_generated = 1 THEN 1 ELSE 0 END) as ai_count
    FROM activity_log
    WHERE dm_sent = 1
AND created_at >= ?
${activityFilter}
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(...base) as Array<{ date: string; count: number; ai_count: number }>;

  // Top keywords
  const topKeywords = db.prepare(`
    SELECT matched_keyword as keyword, COUNT(*) as count
    FROM activity_log
   WHERE dm_sent = 1
AND created_at >= ?
${activityFilter}
    GROUP BY matched_keyword
    ORDER BY count DESC
    LIMIT 10
  `).all(...base) as Array<{ keyword: string; count: number }>;

  // Hourly distribution
  const hourlyDist = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
    FROM activity_log
    WHERE dm_sent = 1
AND created_at >= ?
${activityFilter}
    GROUP BY hour
    ORDER BY hour ASC
  `).all(...base) as Array<{ hour: number; count: number }>;

  // Fill missing hours with 0
  const hourlyMap = new Map(hourlyDist.map((h) => [h.hour, h.count]));
  const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourlyMap.get(i) || 0,
  }));

  // Success rate
  const sent = (db.prepare(
    `SELECT COUNT(*) as count FROM activity_log WHERE dm_sent = 1
AND created_at >= ?
${activityFilter}`
  ).get(...base) as { count: number }).count;
  const failed = (db.prepare(
    `SELECT COUNT(*) as count FROM activity_log WHERE dm_sent = 0
AND created_at >= ?
${activityFilter}`
  ).get(...base) as { count: number }).count;

  // Per-account breakdown
  const perAccount = db.prepare(`
    SELECT a.account_id, COALESCE(acc.instagram_username, 'Default') as username, COUNT(*) as count
    FROM activity_log a
    LEFT JOIN accounts acc ON a.account_id = acc.id
    WHERE a.dm_sent = 1
AND a.created_at >= ?
${activityAliasFilter}
    GROUP BY a.account_id
    ORDER BY count DESC
  `).all(...base) as Array<{ account_id: string; username: string; count: number }>;

  return {
    dms_over_time: dmsOverTime,
    top_keywords: topKeywords,
    hourly_distribution: hourlyDistribution,
    success_rate: { sent, failed },
    per_account: perAccount,
  };
}

// ═══════════════════════════════════════
// ── Users ──
// ═══════════════════════════════════════

export function getUserByEmail(email: string): User | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
}

export function getUserById(id: string): User | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
}

export function getUserByProviderId(providerId: string): User | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE provider_id = ?").get(providerId) as User | undefined;
}

export function createUser(data: {
  email: string;
  name: string;
  password_hash?: string;
  provider: "credentials" | "google";
  provider_id?: string;
}): User {
  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, provider, provider_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, data.email, data.name, data.password_hash || null, data.provider, data.provider_id || null);
  return getUserById(id)!;
}

export function updateUserPlan(
  userId: string,
  data: {
    plan: string;
    dm_limit: number;
    razorpay_customer_id?: string;
    razorpay_subscription_id?: string;
    subscription_status: string;
  }
): User | undefined {
  const db = getDb();
  db.prepare(
    `UPDATE users SET plan = ?, dm_limit = ?, razorpay_customer_id = ?, razorpay_subscription_id = ?, 
     subscription_status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(data.plan, data.dm_limit, data.razorpay_customer_id || null, data.razorpay_subscription_id || null, data.subscription_status, userId);
  return getUserById(userId);
}

export function incrementDmsUsed(userId: string): void {
  const db = getDb();
  db.prepare("UPDATE users SET dms_used_this_month = dms_used_this_month + 1 WHERE id = ?").run(userId);
}

export function resetMonthlyDmUsage(): void {
  const db = getDb();
  db.prepare("UPDATE users SET dms_used_this_month = 0").run();
}

export function setResetToken(email: string, token: string, expiresAt: string): boolean {
  const db = getDb();
  const result = db.prepare(
    "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?"
  ).run(token, expiresAt, email);
  return result.changes > 0;
}

export function getUserByResetToken(token: string): User | undefined {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > datetime('now')"
  ).get(token) as User | undefined;
}

export function clearResetToken(userId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?"
  ).run(userId);
}

export function updatePassword(userId: string, passwordHash: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(passwordHash, userId);
}

export function markOnboardingSeen(userId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE users SET has_seen_onboarding = 1 WHERE id = ?"
  ).run(userId);
}

// ═══════════════════════════════════════
// ── Duplicate DM Prevention ──
// ═══════════════════════════════════════

export function hasDmBeenSent(automationId: string, instagramUserId: string): boolean {
  const db = getDb();
  const row = db.prepare(
    "SELECT 1 FROM sent_dms WHERE automation_id = ? AND instagram_user_id = ?"
  ).get(automationId, instagramUserId);
  return !!row;
}

export function recordSentDm(automationId: string, instagramUserId: string): void {
  const db = getDb();
  const id = uuidv4();
  try {
    db.prepare(
      "INSERT INTO sent_dms (id, automation_id, instagram_user_id) VALUES (?, ?, ?)"
    ).run(id, automationId, instagramUserId);
  } catch {
    // Unique constraint — already recorded, ignore
  }
}

// ═══════════════════════════════════════
// ── Webhook Health ──
// ═══════════════════════════════════════

export function updateWebhookHealth(eventType: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE webhook_health SET last_received_at = datetime('now'), last_event_type = ?, total_received = total_received + 1 WHERE id = 1`
  ).run(eventType);
}

export function getWebhookHealth(): { last_received_at: string | null; last_event_type: string | null; total_received: number } | undefined {
  const db = getDb();
  return db.prepare("SELECT last_received_at, last_event_type, total_received FROM webhook_health WHERE id = 1").get() as { last_received_at: string | null; last_event_type: string | null; total_received: number } | undefined;
}

// ═══════════════════════════════════════
// ── Scheduled Automations ──
// ═══════════════════════════════════════

export function isAutomationActiveNow(automation: {
  is_active: boolean | number;
  schedule_enabled?: boolean | number;
  schedule_start_hour?: number;
  schedule_end_hour?: number;
  schedule_days?: string;
}): boolean {
  if (!automation.is_active) return false;
  if (!automation.schedule_enabled) return true;

  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDay(); // 0=Sun, 6=Sat

  const startHour = automation.schedule_start_hour ?? 0;
  const endHour = automation.schedule_end_hour ?? 23;
  const allowedDays = (automation.schedule_days ?? "0,1,2,3,4,5,6")
    .split(",")
    .map((d) => parseInt(d.trim(), 10));

  if (!allowedDays.includes(currentDay)) return false;
  if (currentHour < startHour || currentHour > endHour) return false;

  return true;
}

export function updateAutomationSchedule(
  id: string,
  schedule: {
    schedule_enabled: boolean;
    schedule_start_hour: number;
    schedule_end_hour: number;
    schedule_days: string;
  }
): Automation | undefined {
  const db = getDb();
  db.prepare(
    `UPDATE automations SET schedule_enabled = ?, schedule_start_hour = ?, schedule_end_hour = ?, schedule_days = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    schedule.schedule_enabled ? 1 : 0,
    schedule.schedule_start_hour,
    schedule.schedule_end_hour,
    schedule.schedule_days,
    id
  );
  return getAutomation(id);
}