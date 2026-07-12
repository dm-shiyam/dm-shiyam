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

-- Records each DM the bot has sent (or claimed the right to send).
--   * Dedup key:      (automation_id, comment_id) — one DM per comment; Meta retries deduped.
--   * Rate limit key: (automation_id, media_id, instagram_user_id) — max 3 DMs per (recipient × post).
-- instagram_user_id kept for audit/analytics + rate limit; comment_id is the dedup key.
CREATE TABLE IF NOT EXISTS sent_dms (
  id                  TEXT        PRIMARY KEY,
  automation_id       TEXT        NOT NULL,
  comment_id          TEXT,
  media_id            TEXT,
  instagram_user_id   TEXT        NOT NULL,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
  CONSTRAINT uq_sent_dms_automation_comment UNIQUE (automation_id, comment_id)
);

-- Comment-reply idempotency: prevents duplicate replies when Meta retries webhooks.
-- comment_id is PRIMARY KEY so INSERT ON CONFLICT acts as atomic mutex.
CREATE TABLE IF NOT EXISTS sent_replies (
  comment_id     TEXT        PRIMARY KEY,
  automation_id  TEXT        NOT NULL,
  replied_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_health (
  id               INTEGER     PRIMARY KEY DEFAULT 1,
  last_received_at TIMESTAMPTZ,
  last_event_type  TEXT,
  total_received   INTEGER     NOT NULL DEFAULT 0
);

-- ── Meta Data Deletion Request audit log ─────────────────────────────────────
-- Records every deletion request received from Meta's data-deletion callback.
-- The `code` is returned to Meta as `confirmation_code` and appears in the
-- public status URL Meta reviewers may visit to verify processing.
-- Status transitions: pending → completed | not_found (no matching account).
CREATE TABLE IF NOT EXISTS deletion_requests (
  code                  TEXT        PRIMARY KEY,
  instagram_account_id  TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'completed', 'not_found')),
  automations_deleted   INTEGER     NOT NULL DEFAULT 0,
  activity_rows_deleted INTEGER     NOT NULL DEFAULT 0,
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
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

-- ═════════════════════════════════════════════════════════════════════════════
-- Migrations (idempotent — safe to re-run on every boot)
-- P13: Schema hardening | P14: Performance indexes | P15: Audit columns
-- ═════════════════════════════════════════════════════════════════════════════

-- ── P15: Audit columns (add before FKs/constraints so existing rows are OK) ──
ALTER TABLE users    ADD COLUMN IF NOT EXISTS last_login_at       TIMESTAMPTZ;
ALTER TABLE users    ADD COLUMN IF NOT EXISTS email_verified_at   TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_refreshed_at        TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_token_warning_sent_at TIMESTAMPTZ;

-- ── sent_dms dedup key migration (per-user → per-comment) + per-post rate limit ──
-- Semantics:
--   * Dedup:      (automation_id, comment_id)                → 1 DM per comment (retries deduped)
--   * Rate limit: (automation_id, media_id, instagram_user_id) → max 3 DMs per (post × recipient)
-- Rationale: users can legitimately comment multiple times and should get DMs each time,
-- but a spammer can't post 100 comments on one reel and get 100 DMs.
ALTER TABLE sent_dms ADD COLUMN IF NOT EXISTS comment_id TEXT;
ALTER TABLE sent_dms ADD COLUMN IF NOT EXISTS media_id   TEXT;

DO $$
BEGIN
  -- Drop the OLD per-user unique constraint if it exists (name Postgres autogenerated)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sent_dms_automation_id_instagram_user_id_key'
  ) THEN
    ALTER TABLE sent_dms DROP CONSTRAINT sent_dms_automation_id_instagram_user_id_key;
  END IF;

  -- Add the NEW per-comment unique constraint if not present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_sent_dms_automation_comment'
  ) THEN
    ALTER TABLE sent_dms
      ADD CONSTRAINT uq_sent_dms_automation_comment
      UNIQUE (automation_id, comment_id);
  END IF;
END $$;

-- ── P13.1-13.3: Add FKs on user_id columns (drop-then-add pattern; skip if fails) ──
DO $$
BEGIN
  -- accounts.user_id → users(id) ON DELETE CASCADE
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_accounts_user'
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT fk_accounts_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- automations.user_id → users(id) ON DELETE CASCADE
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_automations_user'
  ) THEN
    ALTER TABLE automations
      ADD CONSTRAINT fk_automations_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- activity_log.user_id → users(id) ON DELETE SET NULL
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_activity_log_user'
  ) THEN
    ALTER TABLE activity_log
      ADD CONSTRAINT fk_activity_log_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── P13.4-13.6: CHECK constraints on enum-like text columns ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role') THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_role
      CHECK (role IN ('user', 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_plan') THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_plan
      CHECK (plan IN ('free', 'starter', 'pro', 'business', 'agency'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_provider') THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_provider
      CHECK (provider IN ('credentials', 'google'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_subscription_status') THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_subscription_status
      CHECK (subscription_status IN ('none', 'active', 'past_due', 'cancelled', 'expired'));
  END IF;
END $$;

-- ── P14: Performance indexes ──
CREATE INDEX IF NOT EXISTS idx_users_reset_token       ON users(reset_token) WHERE reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sent_dms_by_comment     ON sent_dms(automation_id, comment_id);
CREATE INDEX IF NOT EXISTS idx_sent_dms_rate_limit     ON sent_dms(automation_id, media_id, instagram_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_ig_user        ON activity_log(instagram_user_id);
CREATE INDEX IF NOT EXISTS idx_automations_is_active   ON automations(is_active) WHERE is_active = TRUE;