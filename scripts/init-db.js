const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "dm-shiyam.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
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
    reset_token TEXT,
    reset_token_expires TEXT,
    has_seen_onboarding INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    instagram_account_id TEXT NOT NULL,
    instagram_username TEXT NOT NULL,
    access_token TEXT NOT NULL,
    page_id TEXT,
    token_expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    account_id TEXT,
    name TEXT NOT NULL,
    trigger_keywords TEXT NOT NULL,
    dm_message TEXT NOT NULL,
    reply_comment TEXT,
    ai_enabled INTEGER DEFAULT 0,
    ai_system_prompt TEXT,
    is_active INTEGER DEFAULT 1,
    schedule_enabled INTEGER DEFAULT 0,
    schedule_start_hour INTEGER DEFAULT 0,
    schedule_end_hour INTEGER DEFAULT 23,
    schedule_days TEXT DEFAULT '0,1,2,3,4,5,6',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    total_triggered INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
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
  CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_automations_account ON automations(account_id);
  CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id);
  CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

  INSERT OR IGNORE INTO webhook_health (id, total_received) VALUES (1, 0);
`);

console.log("✅ Database initialized successfully at:", DB_PATH);
console.log("Tables created: users, accounts, automations, activity_log, sent_dms, webhook_health");
db.close();
