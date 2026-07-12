import { readFileSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { query, queryOne, execute, pool, withTransaction } from "./db-client";
import type {
  Account,
  Automation,
  ActivityLog,
  DashboardStats,
  AnalyticsData,
  User,
  AdminStats,
} from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Schema init — runs once on cold start
// ─────────────────────────────────────────────────────────────────────────────

let _initialized = false;

export async function initTables(): Promise<void> {
  if (_initialized) return;
  const schemaPath = path.join(process.cwd(), "schema.sql");
  const ddl = readFileSync(schemaPath, "utf-8");
  await pool.query(ddl);
  _initialized = true;
}

// Call from your Next.js app startup (e.g. instrumentation.ts or route handler)
// We also call it lazily at the top of each exported function in dev.
async function ensureInit() {
  if (!_initialized) await initTables();
}

// ═══════════════════════════════════════
// ── Accounts CRUD ──
// ═══════════════════════════════════════

export async function getAllAccounts(userId?: string): Promise<Account[]> {
  await ensureInit();
  if (userId) {
    return query<Account>(
      "SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
  }
  return query<Account>("SELECT * FROM accounts ORDER BY created_at DESC");
}

export async function getAccount(id: string): Promise<Account | undefined> {
  await ensureInit();
  return queryOne<Account>("SELECT * FROM accounts WHERE id = $1", [id]);
}

export async function getAccountByInstagramId(
  igId: string
): Promise<Account | undefined> {
  await ensureInit();
  return queryOne<Account>(
    "SELECT * FROM accounts WHERE instagram_account_id = $1",
    [igId]
  );
}

export async function createAccount(data: {
  instagram_account_id: string;
  instagram_username: string;
  access_token: string;
  page_id?: string;
  token_expires_at?: string | null;
  user_id?: string;
}): Promise<Account> {
  await ensureInit();
  const id = uuidv4();
  await execute(
    `INSERT INTO accounts
       (id, instagram_account_id, instagram_username, access_token, page_id, token_expires_at, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      data.instagram_account_id,
      data.instagram_username,
      data.access_token,
      data.page_id ?? null,
      data.token_expires_at ?? null,
      data.user_id ?? null,
    ]
  );
  return (await getAccount(id))!;
}

export async function updateAccount(
  id: string,
  data: Partial<{
    instagram_username: string;
    access_token: string;
    page_id: string;
    is_active: boolean;
    token_expires_at: string | null;
  }>
): Promise<Account | undefined> {
  await ensureInit();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (data.instagram_username !== undefined) {
    fields.push(`instagram_username = $${i++}`);
    values.push(data.instagram_username);
  }
  if (data.access_token !== undefined) {
    fields.push(`access_token = $${i++}`);
    values.push(data.access_token);
  }
  if (data.page_id !== undefined) {
    fields.push(`page_id = $${i++}`);
    values.push(data.page_id);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${i++}`);
    values.push(data.is_active);
  }
  if (data.token_expires_at !== undefined) {
    fields.push(`token_expires_at = $${i++}`);
    values.push(data.token_expires_at);
  }
  if (fields.length === 0) return getAccount(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);
  await execute(
    `UPDATE accounts SET ${fields.join(", ")} WHERE id = $${i}`,
    values
  );
  return getAccount(id);
}

export async function getAccountsWithExpiringTokens(
  thresholdDays = 7
): Promise<Account[]> {
  await ensureInit();
  return query<Account>(
    `SELECT * FROM accounts
     WHERE is_active = TRUE
       AND token_expires_at IS NOT NULL
       AND token_expires_at <= NOW() + ($1 || ' days')::INTERVAL
     ORDER BY token_expires_at ASC`,
    [thresholdDays]
  );
}

export async function deleteAccount(id: string): Promise<boolean> {
  await ensureInit();
  return (await execute("DELETE FROM accounts WHERE id = $1", [id])) > 0;
}

// ═══════════════════════════════════════
// ── Automations CRUD ──
// ═══════════════════════════════════════

export async function getAllAutomations(filters?: {
  accountId?: string;
  userId?: string;
}): Promise<Automation[]> {
  await ensureInit();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filters?.accountId) {
    conditions.push(`account_id = $${i++}`);
    params.push(filters.accountId);
  }
  if (filters?.userId) {
    conditions.push(`user_id = $${i++}`);
    params.push(filters.userId);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<Automation>(
    `SELECT * FROM automations ${where} ORDER BY created_at DESC`,
    params
  );
}

export async function getAutomation(
  id: string
): Promise<Automation | undefined> {
  await ensureInit();
  return queryOne<Automation>(
    "SELECT * FROM automations WHERE id = $1",
    [id]
  );
}

export async function getActiveAutomations(
  accountId?: string
): Promise<Automation[]> {
  await ensureInit();
  if (accountId) {
    return query<Automation>(
      "SELECT * FROM automations WHERE is_active = TRUE AND account_id = $1",
      [accountId]
    );
  }
  return query<Automation>(
    "SELECT * FROM automations WHERE is_active = TRUE"
  );
}

export async function createAutomation(data: {
  name: string;
  trigger_keywords: string;
  dm_message: string;
  reply_comment?: string;
  account_id?: string;
  ai_enabled?: boolean;
  ai_system_prompt?: string;
  user_id?: string;
}): Promise<Automation> {
  await ensureInit();
  const id = uuidv4();
  await execute(
    `INSERT INTO automations
       (id, account_id, name, trigger_keywords, dm_message, reply_comment,
        ai_enabled, ai_system_prompt, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      data.account_id ?? null,
      data.name,
      data.trigger_keywords.toLowerCase(),
      data.dm_message,
      data.reply_comment ?? null,
      data.ai_enabled ?? false,
      data.ai_system_prompt ?? null,
      data.user_id ?? null,
    ]
  );
  return (await getAutomation(id))!;
}

export async function updateAutomation(
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
): Promise<Automation | undefined> {
  await ensureInit();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${i++}`);
    values.push(data.name);
  }
  if (data.trigger_keywords !== undefined) {
    fields.push(`trigger_keywords = $${i++}`);
    values.push(data.trigger_keywords.toLowerCase());
  }
  if (data.dm_message !== undefined) {
    fields.push(`dm_message = $${i++}`);
    values.push(data.dm_message);
  }
  if (data.reply_comment !== undefined) {
    fields.push(`reply_comment = $${i++}`);
    values.push(data.reply_comment);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${i++}`);
    values.push(data.is_active);
  }
  if (data.account_id !== undefined) {
    fields.push(`account_id = $${i++}`);
    values.push(data.account_id ?? null);
  }
  if (data.ai_enabled !== undefined) {
    fields.push(`ai_enabled = $${i++}`);
    values.push(data.ai_enabled);
  }
  if (data.ai_system_prompt !== undefined) {
    fields.push(`ai_system_prompt = $${i++}`);
    values.push(data.ai_system_prompt);
  }
  if (fields.length === 0) return getAutomation(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);
  await execute(
    `UPDATE automations SET ${fields.join(", ")} WHERE id = $${i}`,
    values
  );
  return getAutomation(id);
}

export async function deleteAutomation(id: string): Promise<boolean> {
  await ensureInit();
  return (await execute("DELETE FROM automations WHERE id = $1", [id])) > 0;
}

export async function incrementTriggerCount(id: string): Promise<void> {
  await ensureInit();
  await execute(
    "UPDATE automations SET total_triggered = total_triggered + 1 WHERE id = $1",
    [id]
  );
}

// ═══════════════════════════════════════
// ── Activity Log ──
// ═══════════════════════════════════════

export async function logActivity(data: {
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
}): Promise<ActivityLog> {
  await ensureInit();
  const id = uuidv4();
  await execute(
    `INSERT INTO activity_log
       (id, account_id, automation_id, automation_name, instagram_user_id,
        instagram_username, comment_text, matched_keyword, dm_sent,
        comment_replied, ai_generated, error_message, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      data.account_id ?? null,
      data.automation_id,
      data.automation_name,
      data.instagram_user_id,
      data.instagram_username,
      data.comment_text,
      data.matched_keyword,
      data.dm_sent,
      data.comment_replied,
      data.ai_generated ?? false,
      data.error_message ?? null,
      data.user_id ?? null,
    ]
  );
  return (await queryOne<ActivityLog>(
    "SELECT * FROM activity_log WHERE id = $1",
    [id]
  ))!;
}

export async function getActivityLog(
  limit = 50,
  offset = 0,
  filters?: { accountId?: string; userId?: string }
): Promise<ActivityLog[]> {
  await ensureInit();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filters?.accountId) {
    conditions.push(`account_id = $${i++}`);
    params.push(filters.accountId);
  }
  if (filters?.userId) {
    conditions.push(`user_id = $${i++}`);
    params.push(filters.userId);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);
  return query<ActivityLog>(
    `SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`,
    params
  );
}

// ═══════════════════════════════════════
// ── Dashboard Stats ──
// ═══════════════════════════════════════

export async function getDashboardStats(
  userId?: string
): Promise<DashboardStats> {
  await ensureInit();
  const uf = userId ? " AND user_id = $1" : "";
  const p = userId ? [userId] : [];

  const q = async (sql: string) =>
    (await queryOne<{ count: string }>(sql, p))!.count;

  const [
    total_automations,
    active_automations,
    total_dms_sent,
    total_comments_replied,
    dms_today,
    dms_this_week,
    ai_replies,
    accounts_connected,
  ] = await Promise.all([
    q(`SELECT COUNT(*)::int as count FROM automations WHERE 1=1${uf}`),
    q(`SELECT COUNT(*)::int as count FROM automations WHERE is_active = TRUE${uf}`),
    q(`SELECT COUNT(*)::int as count FROM activity_log WHERE dm_sent = TRUE${uf}`),
    q(`SELECT COUNT(*)::int as count FROM activity_log WHERE comment_replied = TRUE${uf}`),
    q(`SELECT COUNT(*)::int as count FROM activity_log WHERE dm_sent = TRUE AND created_at::date = CURRENT_DATE${uf}`),
    q(`SELECT COUNT(*)::int as count FROM activity_log WHERE dm_sent = TRUE AND created_at >= NOW() - INTERVAL '7 days'${uf}`),
    q(`SELECT COUNT(*)::int as count FROM activity_log WHERE ai_generated = TRUE${uf}`),
    q(`SELECT COUNT(*)::int as count FROM accounts WHERE is_active = TRUE${uf}`),
  ]);

  return {
    total_automations: Number(total_automations),
    active_automations: Number(active_automations),
    total_dms_sent: Number(total_dms_sent),
    total_comments_replied: Number(total_comments_replied),
    dms_today: Number(dms_today),
    dms_this_week: Number(dms_this_week),
    ai_replies: Number(ai_replies),
    accounts_connected: Number(accounts_connected),
  };
}

// ═══════════════════════════════════════
// ── Analytics ──
// ═══════════════════════════════════════

export async function getAnalyticsData(
  days = 30,
  userId?: string
): Promise<AnalyticsData> {
  await ensureInit();

  const raw = Number(days);
  const safeDays = Number.isFinite(raw)
    ? Math.max(1, Math.min(365, Math.floor(raw)))
    : 30;

  // Parameterized interval — safe from injection
  const interval = `${safeDays} days`;

  const activityFilter = userId ? " AND activity_log.user_id = $2" : "";
  const activityAliasFilter = userId ? " AND a.user_id = $2" : "";
  const base: unknown[] = userId
    ? [interval, userId]
    : [interval];

  const [dmsOverTime, topKeywords, hourlyDist, sent, failed, perAccount] =
    await Promise.all([
      query<{ date: string; count: number; ai_count: number }>(
        `SELECT
           created_at::date AS date,
           COUNT(*)::int AS count,
           SUM(CASE WHEN ai_generated THEN 1 ELSE 0 END)::int AS ai_count
         FROM activity_log
         WHERE dm_sent = TRUE
           AND created_at >= NOW() - $1::INTERVAL
           ${activityFilter}
         GROUP BY created_at::date
         ORDER BY date ASC`,
        base
      ),

      query<{ keyword: string; count: number }>(
        `SELECT matched_keyword AS keyword, COUNT(*)::int AS count
         FROM activity_log
         WHERE dm_sent = TRUE
           AND created_at >= NOW() - $1::INTERVAL
           ${activityFilter}
         GROUP BY matched_keyword
         ORDER BY count DESC
         LIMIT 10`,
        base
      ),

      query<{ hour: number; count: number }>(
        `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
         FROM activity_log
         WHERE dm_sent = TRUE
           AND created_at >= NOW() - $1::INTERVAL
           ${activityFilter}
         GROUP BY hour
         ORDER BY hour ASC`,
        base
      ),

      queryOne<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM activity_log
         WHERE dm_sent = TRUE AND created_at >= NOW() - $1::INTERVAL
         ${activityFilter}`,
        base
      ),

      queryOne<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM activity_log
         WHERE dm_sent = FALSE AND created_at >= NOW() - $1::INTERVAL
         ${activityFilter}`,
        base
      ),

      query<{ account_id: string; username: string; count: number }>(
        `SELECT
           a.account_id,
           COALESCE(acc.instagram_username, 'Default') AS username,
           COUNT(*)::int AS count
         FROM activity_log a
         LEFT JOIN accounts acc ON a.account_id = acc.id
         WHERE a.dm_sent = TRUE
           AND a.created_at >= NOW() - $1::INTERVAL
           ${activityAliasFilter}
         GROUP BY a.account_id, acc.instagram_username
         ORDER BY count DESC`,
        base
      ),
    ]);

  // Fill missing hours with 0
  const hourlyMap = new Map(hourlyDist.map((h) => [h.hour, h.count]));
  const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourlyMap.get(i) ?? 0,
  }));

  return {
    dms_over_time: dmsOverTime,
    top_keywords: topKeywords,
    hourly_distribution: hourlyDistribution,
    success_rate: {
      sent: Number(sent?.count ?? 0),
      failed: Number(failed?.count ?? 0),
    },
    per_account: perAccount,
  };
}

// ═══════════════════════════════════════
// ── Users ──
// ═══════════════════════════════════════

export async function getUserByEmail(email: string): Promise<User | undefined> {
  await ensureInit();
  return queryOne<User>("SELECT * FROM users WHERE email = $1", [email]);
}

export async function getUserById(id: string): Promise<User | undefined> {
  await ensureInit();
  return queryOne<User>("SELECT * FROM users WHERE id = $1", [id]);
}

export async function getUserByProviderId(
  providerId: string
): Promise<User | undefined> {
  await ensureInit();
  return queryOne<User>(
    "SELECT * FROM users WHERE provider_id = $1",
    [providerId]
  );
}

// Touch users.last_login_at — fire-and-forget from auth callbacks
export async function touchUserLogin(userId: string): Promise<void> {
  await ensureInit();
  await execute("UPDATE users SET last_login_at = NOW() WHERE id = $1", [userId]);
}

// Touch accounts.last_refreshed_at — called after successful IG token refresh
export async function touchAccountRefresh(accountId: string): Promise<void> {
  await ensureInit();
  await execute("UPDATE accounts SET last_refreshed_at = NOW() WHERE id = $1", [accountId]);
}

export async function createUser(data: {
  email: string;
  name: string;
  password_hash?: string;
  provider: "credentials" | "google";
  provider_id?: string;
}): Promise<User> {
  await ensureInit();
  const id = uuidv4();
  await execute(
    `INSERT INTO users (id, email, name, password_hash, provider, provider_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      data.email,
      data.name,
      data.password_hash ?? null,
      data.provider,
      data.provider_id ?? null,
    ]
  );
  return (await getUserById(id))!;
}

export async function updateUserPlan(
  userId: string,
  data: {
    plan: string;
    dm_limit: number;
    razorpay_customer_id?: string;
    razorpay_subscription_id?: string;
    subscription_status: string;
  }
): Promise<User | undefined> {
  await ensureInit();
  await execute(
    `UPDATE users
     SET plan = $1, dm_limit = $2, razorpay_customer_id = $3,
         razorpay_subscription_id = $4, subscription_status = $5,
         updated_at = NOW()
     WHERE id = $6`,
    [
      data.plan,
      data.dm_limit,
      data.razorpay_customer_id ?? null,
      data.razorpay_subscription_id ?? null,
      data.subscription_status,
      userId,
    ]
  );
  return getUserById(userId);
}

export async function incrementDmsUsed(userId: string): Promise<void> {
  await ensureInit();
  await execute(
    "UPDATE users SET dms_used_this_month = dms_used_this_month + 1 WHERE id = $1",
    [userId]
  );
}

/**
 * Atomically claim one DM slot for a user, respecting their plan limit.
 * Returns { claimed: true, newCount, limit } if the slot was reserved.
 * Returns { claimed: false, currentCount, limit } if the user is at/over limit.
 *
 * This is the ONLY safe way to check-and-increment under concurrent webhook
 * delivery. Using `if (used >= limit) skip; else increment` is a race — under
 * load, N concurrent webhooks can all pass the check before any increments.
 */
export async function claimDmSlot(
  userId: string
): Promise<{ claimed: boolean; used: number; limit: number } | null> {
  await ensureInit();
  const rows = await query<{ dms_used_this_month: number; dm_limit: number }>(
    `UPDATE users
     SET dms_used_this_month = dms_used_this_month + 1
     WHERE id = $1
       AND (dm_limit = -1 OR dms_used_this_month < dm_limit)
     RETURNING dms_used_this_month, dm_limit`,
    [userId]
  );

  if (rows.length > 0) {
    return { claimed: true, used: rows[0].dms_used_this_month, limit: rows[0].dm_limit };
  }

  // Claim failed — either user doesn't exist or is at/over limit. Distinguish:
  const existing = await queryOne<{ dms_used_this_month: number; dm_limit: number }>(
    "SELECT dms_used_this_month, dm_limit FROM users WHERE id = $1",
    [userId]
  );
  if (!existing) return null;
  return { claimed: false, used: existing.dms_used_this_month, limit: existing.dm_limit };
}

export async function resetMonthlyDmUsage(): Promise<void> {
  await ensureInit();
  await execute("UPDATE users SET dms_used_this_month = 0");
}

export async function setResetToken(
  email: string,
  token: string,
  expiresAt: string
): Promise<boolean> {
  await ensureInit();
  return (
    (await execute(
      "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3",
      [token, expiresAt, email]
    )) > 0
  );
}

export async function getUserByResetToken(
  token: string
): Promise<User | undefined> {
  await ensureInit();
  return queryOne<User>(
    "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
    [token]
  );
}

export async function clearResetToken(userId: string): Promise<void> {
  await ensureInit();
  await execute(
    "UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1",
    [userId]
  );
}

export async function updatePassword(
  userId: string,
  passwordHash: string
): Promise<void> {
  await ensureInit();
  await execute(
    "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [passwordHash, userId]
  );
}

export async function isAdmin(userId: string): Promise<boolean> {
  await ensureInit();
  const row = await queryOne<{ role: string }>(
    "SELECT role FROM users WHERE id = $1",
    [userId]
  );
  return row?.role === "admin";
}

export async function getAllUsers(): Promise<User[]> {
  await ensureInit();
  return query<User>(
    `SELECT id, email, name, provider, role, plan, subscription_status,
            dm_limit, dms_used_this_month, created_at, updated_at
     FROM users ORDER BY created_at DESC`
  );
}

export async function updateUserRole(
  userId: string,
  role: string
): Promise<User | undefined> {
  await ensureInit();
  await execute(
    "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2",
    [role, userId]
  );
  return getUserById(userId);
}

export async function updateUserAdmin(
  userId: string,
  data: Partial<{
    plan: string;
    dm_limit: number;
    dms_used_this_month: number;
    role: string;
  }>
): Promise<User | undefined> {
  await ensureInit();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (data.plan !== undefined) { fields.push(`plan = $${i++}`); values.push(data.plan); }
  if (data.dm_limit !== undefined) { fields.push(`dm_limit = $${i++}`); values.push(data.dm_limit); }
  if (data.dms_used_this_month !== undefined) { fields.push(`dms_used_this_month = $${i++}`); values.push(data.dms_used_this_month); }
  if (data.role !== undefined) { fields.push(`role = $${i++}`); values.push(data.role); }
  if (fields.length === 0) return getUserById(userId);

  fields.push(`updated_at = NOW()`);
  values.push(userId);
  await execute(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${i}`,
    values
  );
  return getUserById(userId);
}

export async function getAdminStats(): Promise<AdminStats> {
  await ensureInit();

  const cnt = async (sql: string) =>
    Number((await queryOne<{ count: string }>(sql))!.count);

  const [
    total_users,
    active_users_7d,
    total_dms_sent,
    total_dms_failed,
    dms_today,
    dms_this_week,
    total_automations,
    active_automations,
    total_accounts,
    plans,
    recent_errors,
  ] = await Promise.all([
    cnt("SELECT COUNT(*)::int AS count FROM users"),
    cnt(`SELECT COUNT(DISTINCT user_id)::int AS count FROM activity_log
         WHERE created_at >= NOW() - INTERVAL '7 days' AND user_id IS NOT NULL`),
    cnt("SELECT COUNT(*)::int AS count FROM activity_log WHERE dm_sent = TRUE"),
    cnt("SELECT COUNT(*)::int AS count FROM activity_log WHERE dm_sent = FALSE"),
    cnt(`SELECT COUNT(*)::int AS count FROM activity_log
         WHERE dm_sent = TRUE AND created_at::date = CURRENT_DATE`),
    cnt(`SELECT COUNT(*)::int AS count FROM activity_log
         WHERE dm_sent = TRUE AND created_at >= NOW() - INTERVAL '7 days'`),
    cnt("SELECT COUNT(*)::int AS count FROM automations"),
    cnt("SELECT COUNT(*)::int AS count FROM automations WHERE is_active = TRUE"),
    cnt("SELECT COUNT(*)::int AS count FROM accounts WHERE is_active = TRUE"),

    query<{ plan: string; count: number }>(
      "SELECT plan, COUNT(*)::int AS count FROM users GROUP BY plan ORDER BY count DESC"
    ),

    query<{ error_message: string; count: number; last_seen: string }>(
      `SELECT error_message, COUNT(*)::int AS count, MAX(created_at) AS last_seen
       FROM activity_log
       WHERE error_message IS NOT NULL AND error_message != ''
       GROUP BY error_message
       ORDER BY count DESC
       LIMIT 10`
    ),
  ]);

  return {
    total_users,
    active_users_7d,
    total_dms_sent,
    total_dms_failed,
    dms_today,
    dms_this_week,
    total_automations,
    active_automations,
    total_accounts,
    plans,
    recent_errors,
  };
}

export async function deleteUser(userId: string): Promise<boolean> {
  await ensureInit();
  return (await execute("DELETE FROM users WHERE id = $1", [userId])) > 0;
}

export async function markOnboardingSeen(userId: string): Promise<void> {
  await ensureInit();
  await execute(
    "UPDATE users SET has_seen_onboarding = TRUE WHERE id = $1",
    [userId]
  );
}

// ═══════════════════════════════════════
// ── Duplicate DM Prevention (per-comment) ──
// ═══════════════════════════════════════
// Dedup is now keyed on (automation_id, comment_id) so that the SAME user
// commenting multiple distinct comments with the trigger keyword receives
// one DM + one reply per comment. Meta can retry-deliver the same webhook
// event with the same comment_id, so this still protects against retries.

// LEGACY: kept for backwards compat but PREFER claimDmSend below to avoid race conditions
export async function hasDmBeenSent(
  automationId: string,
  commentId: string
): Promise<boolean> {
  await ensureInit();
  if (!commentId) return false; // No comment_id → cannot dedup, allow through
  const row = await queryOne(
    "SELECT 1 FROM sent_dms WHERE automation_id = $1 AND comment_id = $2",
    [automationId, commentId]
  );
  return !!row;
}

// LEGACY: kept for backwards compat but PREFER claimDmSend below
export async function recordSentDm(
  automationId: string,
  commentId: string,
  instagramUserId: string
): Promise<void> {
  await ensureInit();
  const id = uuidv4();
  try {
    await execute(
      "INSERT INTO sent_dms (id, automation_id, comment_id, instagram_user_id) VALUES ($1, $2, $3, $4)",
      [id, automationId, commentId, instagramUserId]
    );
  } catch {
    // Unique constraint violation — already recorded, ignore
  }
}

export type ClaimReason = "duplicate" | "rate_limited";

/**
 * Atomically claim the right to send a DM for a specific comment, enforcing
 * BOTH idempotency AND a per-post rate limit inside an advisory-locked
 * transaction.
 *
 * Dedup: `(automation_id, comment_id)` — Meta retries of the same comment
 * are collapsed to one DM (also blocks the reply from firing twice).
 *
 * Rate limit: at most `maxPerRecipientPerPost` DMs from the same automation to
 * the same Instagram user on the same post/media (lifetime of that post).
 * A new post resets the recipient's budget. Prevents a commenter from spamming
 * "info" 100× on one reel and receiving 100 DMs.
 *
 * Advisory lock is required — verified by regression suite: without it, 50
 * concurrent claims all bypassed a cap of 3 (READ COMMITTED snapshot race).
 */
export async function claimDmSend(
  automationId: string,
  commentId: string,
  mediaId: string,
  instagramUserId: string,
  maxPerRecipientPerPost = 3
): Promise<{ claimed: boolean; reason?: ClaimReason }> {
  await ensureInit();
  const id = uuidv4();

  // Advisory lock scoped to (automation × media × user) makes the count-then-insert
  // truly atomic. Without it, concurrent transactions all see COUNT=0 in their
  // snapshots and every INSERT passes — completely defeating the cap. Empirically
  // verified: without the lock, 50 concurrent claims all succeeded (cap was 3).
  //
  // hashtext returns int4; cast to bigint for the single-arg overload. Collisions
  // between unrelated triples are astronomically unlikely for our key volume;
  // even if they collide, we just serialize two unrelated claims briefly.
  //
  // Lock is transaction-scoped — released automatically on COMMIT/ROLLBACK.
  return withTransaction(async (client) => {
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtext('dm-claim:' || $1 || ':' || $2 || ':' || $3)::bigint
       )`,
      [automationId, mediaId, instagramUserId]
    );

    const ins = await client.query(
      `INSERT INTO sent_dms (id, automation_id, comment_id, media_id, instagram_user_id)
       SELECT $1::text, $2::text, $3::text, $4::text, $5::text
       WHERE (
         SELECT COUNT(*) FROM sent_dms
         WHERE automation_id = $2
           AND media_id = $4
           AND instagram_user_id = $5
       ) < $6
       ON CONFLICT (automation_id, comment_id) DO NOTHING`,
      [id, automationId, commentId, mediaId, instagramUserId, maxPerRecipientPerPost]
    );

    if ((ins.rowCount ?? 0) > 0) return { claimed: true };

    // Insert didn't happen. Distinguish for downstream behavior:
    //   - duplicate:     Meta re-delivered same comment → skip DM AND reply
    //   - rate_limited:  fresh comment, cap reached → skip DM, still reply
    const dup = await client.query(
      `SELECT 1 FROM sent_dms WHERE automation_id = $1 AND comment_id = $2 LIMIT 1`,
      [automationId, commentId]
    );
    return {
      claimed: false,
      reason: (dup.rowCount ?? 0) > 0 ? "duplicate" : "rate_limited",
    };
  });
}

/**
 * Release a previously-successful DM claim for a specific comment. Used when
 * downstream checks (e.g. per-user monthly DM limit) fail AFTER the claim
 * succeeded, so this comment can be retriggered on a future webhook (e.g.
 * after monthly quota resets).
 */
export async function releaseDmClaim(
  automationId: string,
  commentId: string
): Promise<void> {
  await ensureInit();
  await execute(
    "DELETE FROM sent_dms WHERE automation_id = $1 AND comment_id = $2",
    [automationId, commentId]
  );
}

/**
 * Atomically claim the right to send a token-expiry warning email for an account.
 * Returns true if the caller should send (last email > minHours ago OR never sent).
 * Returns false if we sent one recently and should suppress this one.
 * Prevents email spam when the cron runs every 6h against a persistently-broken token.
 */
export async function claimTokenWarningEmail(
  accountId: string,
  minHours = 24
): Promise<boolean> {
  await ensureInit();
  const rowCount = await execute(
    `UPDATE accounts
     SET last_token_warning_sent_at = NOW()
     WHERE id = $1
       AND (last_token_warning_sent_at IS NULL
            OR last_token_warning_sent_at < NOW() - ($2 || ' hours')::INTERVAL)`,
    [accountId, minHours]
  );
  return rowCount > 0;
}

/**
 * Atomically claim the right to reply to a comment. Returns true if this call
 * won the race. Prevents duplicate comment replies when Meta retries webhooks.
 */
export async function claimReply(
  commentId: string,
  automationId: string
): Promise<boolean> {
  await ensureInit();
  const rowCount = await execute(
    `INSERT INTO sent_replies (comment_id, automation_id)
     VALUES ($1, $2)
     ON CONFLICT (comment_id) DO NOTHING`,
    [commentId, automationId]
  );
  return rowCount > 0;
}

// ═══════════════════════════════════════
// ── Webhook Health ──
// ═══════════════════════════════════════

export async function updateWebhookHealth(eventType: string): Promise<void> {
  await ensureInit();
  await execute(
    `UPDATE webhook_health
     SET last_received_at = NOW(), last_event_type = $1,
         total_received = total_received + 1
     WHERE id = 1`,
    [eventType]
  );
}

export async function getWebhookHealth(): Promise<
  | {
      last_received_at: string | null;
      last_event_type: string | null;
      total_received: number;
    }
  | undefined
> {
  await ensureInit();
  return queryOne<{
    last_received_at: string | null;
    last_event_type: string | null;
    total_received: number;
  }>(
    "SELECT last_received_at, last_event_type, total_received FROM webhook_health WHERE id = 1"
  );
}

// ═══════════════════════════════════════
// ── Scheduled Automations ──
// (Pure logic — no DB call, no change needed)
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
  const currentDay = now.getUTCDay();

  const startHour = automation.schedule_start_hour ?? 0;
  const endHour = automation.schedule_end_hour ?? 23;
  const allowedDays = (automation.schedule_days ?? "0,1,2,3,4,5,6")
    .split(",")
    .map((d) => parseInt(d.trim(), 10));

  if (!allowedDays.includes(currentDay)) return false;
  if (currentHour < startHour || currentHour > endHour) return false;

  return true;
}

export async function updateAutomationSchedule(
  id: string,
  schedule: {
    schedule_enabled: boolean;
    schedule_start_hour: number;
    schedule_end_hour: number;
    schedule_days: string;
  }
): Promise<Automation | undefined> {
  await ensureInit();
  await execute(
    `UPDATE automations
     SET schedule_enabled = $1, schedule_start_hour = $2,
         schedule_end_hour = $3, schedule_days = $4, updated_at = NOW()
     WHERE id = $5`,
    [
      schedule.schedule_enabled,
      schedule.schedule_start_hour,
      schedule.schedule_end_hour,
      schedule.schedule_days,
      id,
    ]
  );
  return getAutomation(id);
}

// ═══════════════════════════════════════
// ── Meta Data Deletion Request callback ──
// ═══════════════════════════════════════

export interface DeletionRequestRecord {
  code: string;
  instagram_account_id: string;
  status: "pending" | "completed" | "not_found";
  automations_deleted: number;
  activity_rows_deleted: number;
  requested_at: string;
  completed_at: string | null;
}

/**
 * Purge all Platform Data associated with an Instagram account. Called from
 * Meta's data-deletion callback endpoint after HMAC verification.
 *
 * Deletion cascade (privacy-safe, Meta App Review-compliant):
 *   1. Delete all `automations` for this account
 *      → cascades to `sent_dms`, `sent_replies`, `activity_log` via FK
 *   2. Delete remaining `activity_log` rows scoped to this account
 *      (guards against orphaned rows from deleted automations that had
 *      already SET NULL'd their account_id)
 *   3. Delete the `accounts` row itself (removes IG token + username)
 *
 * We deliberately DO NOT delete the `users` row — the user may have another
 * IG account connected or wish to re-authorize. This matches Meta's expected
 * behavior for revocation-style deletion.
 *
 * Runs inside a single transaction so partial failure leaves DB consistent.
 * Records an audit row in `deletion_requests` regardless of outcome.
 */
export async function processInstagramDataDeletion(
  instagramAccountId: string,
  confirmationCode: string
): Promise<DeletionRequestRecord> {
  await ensureInit();

  return withTransaction(async (client) => {
    // Insert the audit record first so we always have a trace, even if the
    // account lookup fails or the deletion errors mid-way.
    await client.query(
      `INSERT INTO deletion_requests (code, instagram_account_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (code) DO NOTHING`,
      [confirmationCode, instagramAccountId]
    );

    const accountRow = await client.query(
      "SELECT id FROM accounts WHERE instagram_account_id = $1",
      [instagramAccountId]
    );

    if ((accountRow.rowCount ?? 0) === 0) {
      // No account matches this IG user_id. This is normal — Meta will fire
      // the callback for any user who ever authorized the app, even if we
      // already deleted their data or they never completed signup.
      await client.query(
        `UPDATE deletion_requests
         SET status = 'not_found', completed_at = NOW()
         WHERE code = $1`,
        [confirmationCode]
      );
      const row = await client.query(
        "SELECT * FROM deletion_requests WHERE code = $1",
        [confirmationCode]
      );
      return row.rows[0] as DeletionRequestRecord;
    }

    const accountId = accountRow.rows[0].id as string;

    // Delete automations first → cascades to sent_dms, sent_replies, and
    // activity_log rows keyed by automation_id.
    const autoResult = await client.query(
      "DELETE FROM automations WHERE account_id = $1",
      [accountId]
    );

    // Sweep any activity_log rows still referencing this account (they would
    // have had account_id SET NULL if their automation was already deleted,
    // but those linked to still-existing automations of OTHER accounts stay).
    const actResult = await client.query(
      "DELETE FROM activity_log WHERE account_id = $1",
      [accountId]
    );

    // Finally delete the account (IG token + username).
    await client.query("DELETE FROM accounts WHERE id = $1", [accountId]);

    await client.query(
      `UPDATE deletion_requests
       SET status = 'completed',
           automations_deleted = $2,
           activity_rows_deleted = $3,
           completed_at = NOW()
       WHERE code = $1`,
      [confirmationCode, autoResult.rowCount ?? 0, actResult.rowCount ?? 0]
    );

    const row = await client.query(
      "SELECT * FROM deletion_requests WHERE code = $1",
      [confirmationCode]
    );
    return row.rows[0] as DeletionRequestRecord;
  });
}

/**
 * Fetch a deletion request by confirmation code. Used by the public status
 * page Meta reviewers may visit to verify a deletion actually happened.
 */
export async function getDeletionRequest(
  code: string
): Promise<DeletionRequestRecord | undefined> {
  await ensureInit();
  return queryOne<DeletionRequestRecord>(
    "SELECT * FROM deletion_requests WHERE code = $1",
    [code]
  );
}