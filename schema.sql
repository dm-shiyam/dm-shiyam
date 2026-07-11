-- ─────────────────────────────────────────────────────────────────────────────
-- DM Shiyam — Postgres DDL
-- Run once on a fresh DB, or on first app boot via initTables()
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                       TEXT        PRIMARY KEY,
  email                    TEXT        NOT NULL UNIQUE,
  name                     TEXT        NOT NULL,
  password_hash            TEXT,
  provider                 TEXT        NOT NULL DEFAULT 'credentials',
  provider_id              TEXT,
  plan                     TEXT        NOT NULL DEFAULT 'free',
  razorpay_customer_id     TEXT,
  razorpay_subscription_id TEXT,
  subscription_status      TEXT        NOT NULL DEFAULT 'none',
  dm_limit                 INTEGER     NOT NULL DEFAULT 100,
  dms_used_this_month      INTEGER     NOT NULL DEFAULT 0,
  reset_token              TEXT,
  reset_token_expires      TIMESTAMPTZ,
  has_seen_onboarding      BOOLEAN     NOT NULL DEFAULT FALSE,
  role                     TEXT        NOT NULL DEFAULT 'user',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id                    TEXT        PRIMARY KEY,
  instagram_account_id  TEXT        NOT NULL UNIQUE,
  instagram_username    TEXT        NOT NULL,
  access_token          TEXT        NOT NULL,
  page_id               TEXT,
  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,
  token_expires_at      TIMESTAMPTZ,
  user_id               TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automations (
  id                  TEXT        PRIMARY KEY,
  account_id          TEXT,
  user_id             TEXT,
  name                TEXT        NOT NULL,
  trigger_keywords    TEXT        NOT NULL,
  dm_message          TEXT        NOT NULL,
  reply_comment       TEXT,
  ai_enabled          BOOLEAN     NOT NULL DEFAULT FALSE,
  ai_system_prompt    TEXT,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  total_triggered     INTEGER     NOT NULL DEFAULT 0,
  schedule_enabled    BOOLEAN     NOT NULL DEFAULT FALSE,
  schedule_start_hour INTEGER     NOT NULL DEFAULT 0,
  schedule_end_hour   INTEGER     NOT NULL DEFAULT 23,
  schedule_days       TEXT        NOT NULL DEFAULT '0,1,2,3,4,5,6',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  id                  TEXT        PRIMARY KEY,
  account_id          TEXT,
  automation_id       TEXT        NOT NULL,
  automation_name     TEXT        NOT NULL,
  user_id             TEXT,
  instagram_user_id   TEXT        NOT NULL,
  instagram_username  TEXT        NOT NULL,
  comment_text        TEXT        NOT NULL,
  matched_keyword     TEXT        NOT NULL,
  dm_sent             BOOLEAN     NOT NULL DEFAULT FALSE,
  comment_replied     BOOLEAN     NOT NULL DEFAULT FALSE,
  ai_generated        BOOLEAN     NOT NULL DEFAULT FALSE,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id)   REFERENCES accounts(id)   ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sent_dms (
  id                  TEXT        PRIMARY KEY,
  automation_id       TEXT        NOT NULL,
  instagram_user_id   TEXT        NOT NULL,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
  UNIQUE (automation_id, instagram_user_id)
);

CREATE TABLE IF NOT EXISTS webhook_health (
  id               INTEGER     PRIMARY KEY DEFAULT 1,
  last_received_at TIMESTAMPTZ,
  last_event_type  TEXT,
  total_received   INTEGER     NOT NULL DEFAULT 0
);

-- Seed the single webhook_health row (idempotent)
INSERT INTO webhook_health (id, total_received)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_created    ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_automation ON activity_log(automation_id);
CREATE INDEX IF NOT EXISTS idx_activity_account    ON activity_log(account_id);
CREATE INDEX IF NOT EXISTS idx_activity_user       ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_automations_account ON automations(account_id);
CREATE INDEX IF NOT EXISTS idx_automations_user    ON automations(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user       ON accounts(user_id);