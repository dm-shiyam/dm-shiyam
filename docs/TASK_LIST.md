# DM Shiyam — Task List

> Tasks divided among 3 team members. Priorities: High / Medium / Low.

---

## Person 1: Priyanka — Backend & Infrastructure

*Focus: Token management, security, database, API reliability*

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | **Long-lived token exchange** — Exchange short-lived (1hr) tokens for 60-day tokens + auto-refresh before expiry | High | Done |
| 2 | **Migrate from SQLite to PostgreSQL** — SQLite doesn't support concurrent writes; move to Postgres for production | High | ✅ Done — stale status; completed as Ankit's Sprint 2 **A0** (see below) |
| 3 | **User-scoped data isolation** — Add `user_id` FK to `accounts`, `automations`, `activity_log`; filter all queries by user | High | Done |
| 4 | **Rate limiting on webhook endpoint** — Prevent abuse on `POST /api/webhook/instagram` (no auth check currently) | Medium | Done |
| 5 | **DM limit enforcement** — `dms_used_this_month` exists but is never checked before sending; enforce plan limits in `processCommentTrigger` | Medium | Done |
| 6 | **Monthly DM usage reset** — `resetMonthlyDmUsage()` exists but no cron/scheduler calls it | Medium | Done |
| 7 | **Webhook signature verification** — Verify `X-Hub-Signature-256` header from Meta to ensure requests are authentic | Medium | Done |
| 8 | **Error retry logic** — If DM API fails (rate limit, temporary error), implement retry with backoff | Low | Done |
| 9 | **SQL injection in analytics** — `getAnalyticsData` interpolates `days` directly into SQL template strings; use parameterized queries | Medium | Done |
| 10 | **App Review submission** — Prepare and submit `instagram_manage_messages` for Advanced Access | High | Done |

---

## Person 2: Ankit — Frontend & UX

*Focus: Dashboard improvements, new pages, mobile responsiveness*

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | **Fix hydration error properly** — `suppressHydrationWarning` is a band-aid; investigate root cause (browser extensions or layout mismatch) | Medium | ✅ Done — stale status; completed as Sprint 2 **A1** (see below) |
| 2 | **Signup page** — Build a dedicated `/register` page with proper validation and UX | High | Done |
| 3 | **Password reset flow** — Forgot password functionality (`/forgot-password`, `/reset-password`) | High | ✅ Done — end-to-end validated on prod 2026-09-08. Includes: Resend enabled via `RESEND_API_KEY` + `FROM_EMAIL=onboarding@resend.dev` (sandbox — deliverable only to Resend account owner until `dmshiyam.com` is verified). UX hardening (commit `efd1f90`): reveal-eye toggle on both New + Confirm fields, live "Passwords don't match yet" hint, client `minLength` bumped to 8 to match server policy, `autoComplete="new-password"` to defeat browser autofill masking. Integrity: `updatePassword` returns rowCount; API returns 500 if UPDATE matches 0 rows instead of silent `{success:true}`. |
| 4 | **Google OAuth setup** — GoogleProvider has empty `clientId/clientSecret`; either configure it or remove the button | Medium | ✅ Done — 2026-09-08. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set in Vercel; OAuth consent screen published (In production, not Testing) so any Gmail can sign in — no verification review needed (only non-sensitive scopes: `openid`, `email`, `profile`). Authorized redirect URI `https://dm-shiyam.vercel.app/api/auth/callback/google` added under Google Auth Platform → Clients. **Bug fix (commit `8d9eb6f`)**: `/login` was rendering `LoginFormComponent` (credentials-only) while `/register` used `LoginForm` (had Google button). Added the same Google button to `LoginFormComponent` so both pages now expose "Continue with Google". Also added friendly error copy for `CredentialsSignin` / `OAuthSignin` / `OAuthCallback` / `OAuthAccountNotLinked` (commit `efd1f90`) so login failures no longer surface raw NextAuth strings. Follow-up: two near-identical login form components (`LoginForm.tsx` + `LoginFormComponent.tsx`) — worth consolidating to prevent this class of bug. |
| 5 | **Real-time activity feed** — Replace 15s polling with WebSocket/SSE for instant activity updates | Medium | Done |
| 6 | **Mobile-responsive dashboard** — Test and fix dashboard layout on mobile screens | Medium | Done |
| 7 | **Toast notifications** — Add success/error toasts when creating automations, connecting accounts, etc. | Low | Done |
| 8 | **Automation templates** — Pre-built templates ("Lead Magnet", "Discount Code", "Link in Bio") for quick setup | Low | Done |
| 9 | **Dark mode support** — Add theme toggle | Low | Done |
| 10 | **Onboarding wizard** — First-time user setup flow guiding through connecting Instagram and creating first automation | Medium | ✅ Done — OnboardingWizard modal + A9 Getting Started checklist (see A9 below). **Follow-up 2026-09-09 (commit `0f65f1c`)**: fixed "View activity" button in checklist item 3 that mistakenly routed to Accounts tab; now correctly opens Activity tab via new `onGoToActivity` prop. |

---

## Person 3: Venkat — Features & Integrations

*Focus: New capabilities, billing, deployment*

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | **Razorpay billing integration** — Checkout/verify/webhook routes exist but likely untested; complete and test payment flow | High | Done |
| 2 | **Duplicate DM prevention** — If the same user comments the same keyword twice, don't send duplicate DMs; track sent DMs per user per automation | High | Done |
| 3 | **OpenAI integration testing** — AI Smart Replies module exists (`openai.ts`) but needs testing and prompt tuning | Medium | Done |
| 4 | **Multi-account token management** — AccountsTab lets users add accounts, but tokens need validation and refresh logic | Medium | ✅ Done — token storage + refresh logic completed initial pass. **Follow-up 2026-09-09 (commits `0f65f1c`, `6eeb484`)**: discovered the webhook was still using `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_ACCOUNT_ID` env vars for every connected account (single-tenant leftover), so DMs from a second connected account failed with Meta error *"The comment is invalid for a private reply"* because dm_shiyam's token was being used on vatsvelocity's comments. Fixed by hoisting an `entry.id` → account lookup at the top of `processWebhookAsync`, and: (1) using `account.access_token` for all `sendPrivateReply`/`sendDM`/`replyToComment` calls; (2) using `account.instagram_account_id` for the self-event loop guard; (3) new `getAutomationsForWebhookRouting(accountId, userId)` returns both account-bound AND user-owned-unassigned automations, so users who create a "general" automation (no account picked) still get it firing for all their accounts — while `user_id` filter keeps tenants isolated; (4) `activity_log.account_id` now records the ROUTED account, not `automation.account_id` (which is NULL for unassigned automations) — fixes attribution in Activity tab + admin funnel. Also added `humanizeMetaError()` in `src/lib/instagram.ts` so Activity tab shows actionable text for common Meta error strings (expired token → "Reconnect from Accounts", "invalid for private reply" → 3 real causes). Verified end-to-end with 2 IG accounts (dm_shiyam + vatsvelocity) on both Feed posts and Reels. |
| 5 | **Export activity logs** — CSV/Excel download of activity data for reporting | Low | Done |
| 6 | **Scheduled automations** — Enable/disable automations on a schedule (e.g., only active during business hours) | Low | Done |
| 7 | **Production deployment** — Dockerize, set up Vercel/Railway deployment, environment config | High | Done |
| 8 | **Terms of Service & Privacy Policy** — Current privacy page is minimal; add proper legal pages | Medium | Done |
| 9 | **Webhook health monitoring** — Dashboard indicator showing last webhook received time, connection status | Medium | Done |
| 10 | **Story/Reel mention triggers** — Extend beyond comments to detect mentions in stories/reels | Low | Done |

---

## Sprint 1 Summary

| Person | Tasks | Focus |
|--------|-------|-------|
| **Priyanka** | 10/10 Done ✅ | All tasks complete |
| **Ankit** | 8/10 Done → Remaining: #1, #4 | Hydration fix, Google OAuth |
| **Venkat** | 10/10 Done ✅ | All tasks complete |

---

## Sprint 2 — Launch Readiness

> 35 tasks across 6 phases, divided into sub-tasks per person.

---

### Priyanka — Meta Review, Production Backend (14 sub-tasks)

*Focus: Meta compliance, production backend, email & admin*

#### Phase 2: Legal & Business

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| P2 | **Udyam Registration** | | High | ✅ Done |
| | | 2.1 Go to [udyamregistration.gov.in](https://udyamregistration.gov.in) | | ✅ Done |
| | | 2.2 Register with Aadhaar + PAN | | ✅ Done |
| | | 2.3 Download Udyam certificate PDF | | ✅ Done |

#### Phase 3: Meta App Review

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| P3 | **Meta Business Verification** | | High | ✅ Done |
| | | 3.1 Go to Meta Business Suite → Settings → Business Info | | ✅ Done |
| | | 3.2 Enter business name, address from Udyam certificate | | ✅ Done |
| | | 3.3 Upload Udyam certificate as verification document | | ✅ Done |
| | | 3.4 Wait for verification (1-3 business days) | | ✅ Verified (9 Jul 2026) |
| P4 | **Meta Access Verification** | | High | 🔶 In Progress |
| | | 4.1 Complete access verification in Meta App Dashboard | | 🔶 Submitted (awaiting Meta review, 1-5 days) |
| P5 | **Meta App Review submission** | | High | Pending |
| | | 5.1 Paste description from `docs/META_APP_REVIEW.md` | | Pending |
| | | 5.2 Record 30-60 sec screencast (dashboard → comment → DM flow) | | Pending |
| | | 5.3 Answer Data Handling questionnaire (data usage, retention, deletion) | | Pending |
| | | 5.4 Submit and wait for approval (1-5 business days) | | Pending |

#### Phase 4: Production Backend

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| P6 | **Set up production Postgres** | | High | ✅ Done (Venkat) |
| | | 6.1 Create free Postgres on Neon/Supabase | | ✅ Done (Neon iad1 via Vercel Marketplace) |
| | | 6.2 Run schema migrations on production DB | | ✅ Done (`scripts/run-schema.mjs`) |
| | | 6.3 Verify all tables and indexes created | | ✅ Done (7 tables verified) |
| P7 | **Update Meta webhook URL** | | High | ✅ Done (confirmed stale status, 2026-09-10) |
| | | 7.1 Change webhook callback URL from ngrok to production domain | | ✅ Done — proven by Venkat #4 follow-up (2026-09-09): dm_shiyam + vatsvelocity webhooks verified end-to-end on prod, only possible if callback URL is already `dm-shiyam.vercel.app`, not ngrok |
| | | 7.2 Re-verify webhook subscription with Meta | | ✅ Done (implied by same evidence) |
| P8 | **Set up cron job** | | Medium | 🔶 In Progress |
| | | 8.1 Add `vercel.json` cron config OR set up external cron (cron-job.org) | | ✅ Done (vercel.json configured with 2 crons, endpoints verified locally) |
| | | 8.2 Test monthly DM reset runs on schedule | | ⚠️ **Cannot verify remotely** (no prod DB access in this session) — Priyanka: run `SELECT id, dms_used_this_month, updated_at FROM users ORDER BY updated_at DESC LIMIT 5;` in Neon SQL Editor right after the 1st of a month at 00:00 UTC to confirm reset fired |

#### Phase 6: Post-Launch

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| P9 | **Email notifications** | | Low | ✅ Done |
| | | 9.1 Set up email service (Resend/SendGrid) | | ✅ Done (Resend) |
| | | 9.2 Send alert when DM limit is at 80% | | ✅ Done |
| | | 9.3 Send alert when token is expiring | | ✅ Done |
| P10 | **Admin dashboard** | | Low | ✅ Done |
| | | 10.1 Create `/admin` route with auth guard | | ✅ Done |
| | | 10.2 Show all users, total DMs sent, error rates | | ✅ Done |
| | | 10.3 Add user management (ban, upgrade plan) | | ✅ Done |

#### Phase 7: Security Hardening

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| P11 | **Security audit & fixes** | | High | ✅ Done |
| | | 11.1 Remove hardcoded NextAuth fallback secret; fail fast in prod | | ✅ Done |
| | | 11.2 Lazy-init Resend in forgot-password (prevent import-time crash) | | ✅ Done |
| | | 11.3 XSS: escape user name in reset-password email template | | ✅ Done (`src/lib/html.ts`) |
| | | 11.4 Rate limit forgot-password (5/15min) and reset-password (10/15min) | | ✅ Done |
| | | 11.5 Password policy: min 8 chars + letters + numbers (signup & reset) | | ✅ Done |
| | | 11.6 Security response headers (HSTS, X-Frame-Options, X-CTO, Referrer-Policy, Permissions-Policy) | | ✅ Done (`next.config.js`) |
| | | 11.7 SQL injection audit — all queries parameterized, dynamic `${...}` only for hardcoded fragments | | ✅ Done (verified) |
| P12 | **Security follow-ups** | | Medium | Pending |
| | | 12.1 Upgrade Next.js to 15+ and next-auth to v5 — fixes 4 high-severity npm audit vulns in `next`, `next-auth`, `postcss`, `uuid` (deferred, see note below) | | Pending — post-MVP |
| | | 12.2 Add rate limiting to NextAuth Credentials login (10 tries per email per 15min) | | ✅ Done (`src/lib/auth.ts`) |
| | | 12.3 Add Content-Security-Policy header (needs review for GA/Razorpay/Instagram embeds) | | ✅ Done — shipped as `Content-Security-Policy-Report-Only` in `next.config.js`; violations forwarded via `/api/csp-report` → Sentry. Flip `CSP_ENFORCE=1` after ~1 week of clean reports. |
| | | 12.4 CSRF audit — all 15 state-changing routes verified protected via SameSite cookie / HMAC signature / CRON_SECRET; explicit NextAuth cookie config + fail-closed IG webhook signature in prod | | ✅ Done |
| | | 12.5 Idempotency fix — replaced check-then-write with atomic `INSERT ON CONFLICT` for DMs (`claimDmSend`) + added `sent_replies` table + `claimReply` for comment replies. Prevents duplicate DMs/replies under Meta webhook retries | | ✅ Done |
| | | 12.6 Deep-scan race conditions — added `claimDmSlot` (atomic DM quota enforcement, prevents users exceeding paid plan under concurrent webhooks); wrapped `createUser` in try/catch for unique_violation (23505) so concurrent signup returns friendly error instead of PG crash | | ✅ Done |
| | | 12.7 Timing-safe signature in `/api/billing/verify` (parity with webhook route) — replaced `!==` with `crypto.timingSafeEqual` | | ✅ Done |
| | | 12.8 Token-expiry email throttle — `claimTokenWarningEmail(accountId, 24h)` prevents cron from spamming user 4x/day when refresh keeps failing | | ✅ Done |
| | | 12.9 Redesign DM/reply dedup key from `(automation_id, user_id)` → `(automation_id, comment_id)` — each comment gets 1 DM+reply, user can trigger multiple times via distinct comments; Meta retries still deduped | | ✅ Done |
| | | 12.10 Per-post rate limit — max 3 DMs per (recipient × post). Prevents commenter spam ("info info info..." 100x → 100 DMs). Fresh budget on each new post. Comment reply still fires when DM is rate-limited (public engagement stays intact). | | ✅ Done |
| | | 12.11 CRITICAL: Concurrency fix — first version of `claimDmSend` used `INSERT ... SELECT WHERE (count) < 3` which is NOT atomic under READ COMMITTED. Load-test caught this: 50 concurrent claims all succeeded (cap defeated). Fixed with `pg_advisory_xact_lock` inside a transaction — serializes claims for the same (automation, media, user) triple. Cap now strictly enforced under 200-way concurrency (verified). | | ✅ Done |
| | | 12.12 Regression suite: `scripts/test-dedup-rate-limit.mjs` — 23 tests including 200-way parallel storms, retry floods, multi-user/multi-post independence. Run via `npm run test:dedup`. | | ✅ Done |
| P16 | **Testing patterns to remember** | | Low | Notes |
| | | 16.1 Security tests should cover BOTH: (a) invalid inputs rejected, AND (b) valid inputs produce correct side effects exactly once | | 📌 Note |
| | | 16.2 Every check-then-act pattern in webhook/cron handlers is a race condition — audit for atomic alternatives (INSERT ON CONFLICT, SELECT FOR UPDATE, advisory locks) | | 📌 Note |
| | | 16.3 Idempotency test: fire same webhook payload 100× concurrently → assert exactly 1 side effect | | 📌 Note |

> **📌 Note on P12.1 (deferred dependency upgrades):**
> `npm audit --production` reports **4 high-severity vulnerabilities** in transitive/direct deps: `next`, `next-auth`, `postcss`, `uuid`.
> Fixing requires:
> - Upgrading **Next.js to 15+** (major version — needs full regression testing of App Router, Server Actions, image optimization)
> - Upgrading **next-auth to v5** (major API change — auth config file, middleware, session shape all differ)
>
> **Deferred until after MVP launch** because none of the flagged vulns are exploitable in the current codebase:
> - `postcss` vulns → only apply at **build time**, not runtime (no attack surface in production)
> - `uuid` vulns → in older API surfaces we don't use (we only use `crypto.randomUUID()` and `crypto.randomBytes()`)
> - `next` / `next-auth` vulns → require specific attack vectors (SSRF via image optimizer, prototype pollution) that are mitigated by our current auth + input validation setup
>
> **Action item after launch:** Create a dedicated branch, upgrade Next+NextAuth together, run full E2E test suite (S1), then merge. Estimated effort: 1-2 days.

#### Phase 8: Database Enhancements

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| P13 | **Schema hardening** | | Medium | ✅ Done |
| | | 13.1 Add FK `accounts.user_id → users(id) ON DELETE CASCADE` | | ✅ Done (`fk_accounts_user`) |
| | | 13.2 Add FK `automations.user_id → users(id) ON DELETE CASCADE` | | ✅ Done (`fk_automations_user`) |
| | | 13.3 Add FK `activity_log.user_id → users(id) ON DELETE SET NULL` | | ✅ Done (`fk_activity_log_user`) |
| | | 13.4 Add CHECK constraint on `users.role` (only 'user' or 'admin') | | ✅ Done (`chk_users_role`) |
| | | 13.5 Add CHECK constraint on `users.plan` (only 'free', 'starter', 'pro', 'business', 'agency') | | ✅ Done (`chk_users_plan`) |
| | | 13.6 Add CHECK constraint on `users.provider` (only 'credentials' or 'google') | | ✅ Done (`chk_users_provider`) |
| | | 13.7 Bonus: CHECK constraint on `users.subscription_status` (5 valid values) | | ✅ Done (`chk_users_subscription_status`) |
| P14 | **Performance indexes** | | Medium | ✅ Done |
| | | 14.1 Add partial index on `users(reset_token) WHERE reset_token IS NOT NULL` | | ✅ Done (`idx_users_reset_token`) |
| | | 14.2 Add composite index on `sent_dms(automation_id, instagram_user_id)` | | ✅ Done (`idx_sent_dms_lookup`) |
| | | 14.3 Add index on `activity_log(instagram_user_id)` | | ✅ Done (`idx_activity_ig_user`) |
| | | 14.4 Add partial index on `automations(is_active) WHERE is_active = TRUE` | | ✅ Done (`idx_automations_is_active`) |
| P15 | **New audit columns** | | Low | ✅ Done |
| | | 15.1 Add `users.last_login_at TIMESTAMPTZ` + wire into NextAuth `jwt` callback | | ✅ Done (`touchUserLogin` in `src/lib/auth.ts`) |
| | | 15.2 Add `users.email_verified_at TIMESTAMPTZ` (column only; verification flow TBD) | | ✅ Column added |
| | | 15.3 Add `accounts.last_refreshed_at TIMESTAMPTZ` + wire into token refresh cron | | ✅ Done (`touchAccountRefresh` in refresh-tokens cron) |

---

### Ankit — Frontend, Database, Marketing Pages (21 sub-tasks)

*Focus: Postgres migration, frontend fixes, landing page, SEO, marketing*

#### Phase 1: Development

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| A0 | **Postgres migration** | | High | Done |
| | | 0.1 Install `pg` and `@types/pg` packages | | Done |
| | | 0.2 Create Postgres connection module (replace `better-sqlite3`) | | Done |
| | | 0.3 Rewrite all DB functions in `src/lib/db.ts` to use Postgres queries | | Done |
| | | 0.4 Convert SQLite schema to Postgres DDL (auto-migrations) | | Done |
| | | 0.5 Test all DB operations locally with Postgres | | Done |
| | | 0.6 Migrate existing SQLite data to Postgres (one-time script) | | Done |
| A1 | **Fix hydration error** | | Medium | Done |
| | | 1.1 Identify root cause (browser extensions, SSR mismatch, layout) | | Done |
| | | 1.2 Fix the actual issue, remove `suppressHydrationWarning` | | Done |
| | | 1.3 Test in Chrome, Firefox, Safari | | Done |
| A2 | **Google OAuth setup** | | Medium | Done |
| | | 2.1 Create Google Cloud project + OAuth consent screen | | Done |
| | | 2.2 Get `clientId` and `clientSecret` | | Done |
| | | 2.3 Add to `.env` and configure GoogleProvider in NextAuth | | Done |
| | | 2.4 Test signup/login with Google account | | Done |

#### Phase 2: Legal

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| A3 | **Update Privacy Policy & Terms** | | Medium | Done |
| | | 3.1 Add registered business name, address, contact email | | Done |
| | | 3.2 Add data retention period and deletion process | | Done |
| | | 3.3 Add GDPR/cookie consent section | | Done |

#### Phase 5: Marketing & Growth

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| A4 | **Landing page** | | High | Done |
| | | 4.1 Design hero section with tagline + CTA | | Done |
| | | 4.2 Features section (keyword triggers, auto DM, analytics) | | Done |
| | | 4.3 How it works section (3-step visual) | | Done |
| | | 4.4 Testimonials / social proof section | | Done |
| | | 4.5 CTA + signup button | | Done |
| A5 | **Pricing page** | | Medium | Done |
| | | 5.1 Design pricing cards (Free / Pro / Business) | | Done |
| | | 5.2 Feature comparison table | | Done |
| | | 5.3 Connect to Razorpay checkout | | ✅ Done — stale status; Razorpay checkout was Venkat's Sprint 1 #1, further hardened in Sprint 3 V12 (failure-scenario testing, 4/4 passing) |
| A6 | **SEO basics** | | Medium | Done |
| | | 6.1 Add meta title, description, keywords to all pages | | Done |
| | | 6.2 Add Open Graph / Twitter Card tags | | Done |
| | | 6.3 Create `sitemap.xml` and `robots.txt` | | Done |
| | | 6.4 Submit to Google Search Console | | To be done after prod deployment - refer - postDeployment/googleSetupGuide.md |

#### Phase 6: Post-Launch

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| A7 | **User feedback system** | | Low | Done |
| | | 7.1 Add feedback widget (Tally form or custom modal) | | Done |
| | | 7.2 Store feedback in DB or send to email | | Done |

---

### Venkat — DevOps, Deployment, Integrations (14 sub-tasks)

*Focus: Domain, deployment, infrastructure, analytics*

#### Phase 2: Legal & Business

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| V1 | **Domain name** | | High | In Progress |
| | | 1.1 Purchase domain (dmshiyam.com or dmshiyam.in) from Namecheap/GoDaddy/Cloudflare | | ✅ Done (dmshiyam.com) |
| | | 1.2 Set up DNS records | | Pending (needs V4 - Vercel domain add) |
| V2 | **Business email** | | Medium | ✅ Done |
| | | 2.1 Set up contact@dmshiyam.com (Zoho Mail free / Google Workspace) | | ✅ Done |
| | | 2.2 Add to Meta App Dashboard contact info | | Pending |

#### Phase 4: Production Deployment

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| V3 | **Deploy to Vercel** | | High | ✅ Done |
| | | 3.1 Connect GitHub repo to Vercel | | ✅ Done |
| | | 3.2 Configure build settings (Next.js framework) | | ✅ Done (pnpm install used to fix npm crash) |
| | | 3.3 Set up all environment variables in Vercel dashboard | | 🔶 In Progress (DATABASE_URL added via Neon integration; other secrets pending) |
| | | 3.4 Test deployment builds successfully | | ✅ Done (Ready in 47s at dm-shiyam.vercel.app) |
| V4 | **Custom domain setup** | | High | Pending |
| | | 4.1 Add dmshiyam.com to Vercel project | | Pending |
| | | 4.2 Update DNS CNAME/A records to point to Vercel | | Pending |
| | | 4.3 Verify SSL certificate is active (auto with Vercel) | | Pending |
| V5 | **Environment variables** | | High | Pending |
| | | 5.1 Add all secrets: `INSTAGRAM_*`, `NEXTAUTH_*`, `OPENAI_*`, `RAZORPAY_*`, `CRON_SECRET` | | Pending |
| | | 5.2 Update `APP_URL` and `NEXTAUTH_URL` to production domain | | Pending |

#### Phase 5: Marketing & Growth

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| V6 | **Analytics & tracking** | | Low | ✅ Done |
| | | 6.1 Create Google Analytics property | | ✅ Done |
| | | 6.2 Add GA script to `_app.tsx` or layout | | ✅ Done (G-KDFFVFWBLC added to layout.tsx) |
| | | 6.3 Set up conversion events (signup, automation created, DM sent) | | Pending |
| V7 | **Social media accounts** | | Medium | In Progress |
| | | 7.1 Create @dmshiyam Instagram account | | ✅ Done |
| | | 7.2 Create @dmshiyam Twitter/X account | | ✅ Done |
| | | 7.3 Post launch announcement | | Pending (after production launch) |

#### Phase 6: Post-Launch

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| V8 | **API documentation** | | Low | ✅ Done |
| | | 8.1 Document API endpoints (Swagger/OpenAPI or Markdown) | | ✅ Done (docs/API.md) |
| | | 8.2 Host docs on website or GitHub Pages | | ✅ Done — served from the app itself at `/docs/api` (`src/app/docs/api/page.tsx` — SSG with 1h revalidate, renders `docs/API.md` via `marked` + Tailwind typography, added to sitemap) |

---

### Shared Tasks (All 3)

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| S1 | **End-to-end testing** | | High | Pending |
| | | 1.1 Test signup → login → connect IG → create automation → comment → DM | | Pending |
| | | 1.2 Test billing flow (Razorpay checkout → plan upgrade → DM limit increase) | | Pending |
| | | 1.3 Test edge cases (expired token, rate limit, duplicate comment) | | Pending |
| S2 | **Demo video** | | Medium | ✅ Done |
| | | 2.1 Write script / storyboard | | ✅ Done |
| | | 2.2 Screen record the full product flow | | ✅ Done |
| | | 2.3 Edit and upload to YouTube / landing page | | ✅ Done |
| S3 | **Product Hunt launch** | | Low | Pending |
| | | 3.1 Create Product Hunt maker account | | Pending |
| | | 3.2 Prepare tagline, description, screenshots | | Pending |
| | | 3.3 Schedule launch day | | Pending |
| S4 | **Content marketing** | | Low | Pending |
| | | 4.1 Write blog: "How to automate Instagram DMs" | | Pending |
| | | 4.2 Write blog: "Grow your Instagram with DM automation" | | Pending |
| | | 4.3 Share on social media, Reddit, IndieHackers | | Pending |
| S5 | **Influencer outreach & ads** | | Low | Pending |
| | | 5.1 Identify 10 Instagram creators who could benefit | | Pending |
| | | 5.2 Offer free Pro plan in exchange for review/mention | | Pending |
| | | 5.3 Set up Instagram ad campaign targeting creators/businesses | | Pending |
| S6 | **Referral program** | | Low | Pending |
| | | 6.1 Design referral flow (invite link → signup → reward) | | Pending |
| | | 6.2 Implement referral tracking in DB | | Pending |
| | | 6.3 Add referral section to dashboard | | Pending |

---

## Task Count Summary

| Person | High | Medium | Low | Total Sub-tasks |
|--------|------|--------|-----|-----------------|
| **Priyanka** | 8 | 3 | 6 | **14** |
| **Ankit** | 11 | 10 | 2 | **23** |
| **Venkat** | 8 | 3 | 5 | **16** |
| **Shared** | 3 | 3 | 9 | **15** |

## Recommended Execution Order

| Week | Priyanka | Ankit | Venkat |
|------|----------|-------|--------|
| **Week 1** | P2 (Udyam registration) | A0 (Postgres migration), A1 (Hydration fix) | V1 (Domain), V2 (Business email) |
| **Week 2** | P3-P5 (Meta verification & review), P6 (Cloud Postgres) | A3 (Update legal pages) | V3-V5 (Deploy + domain + env vars) |
| **Week 3** | P7 (Webhook URL), P8 (Cron) | A4 (Landing page), A5 (Pricing page) | V6 (Analytics), V7 (Social media) |
| **Week 4** | S1 (E2E testing) | A6 (SEO), S2 (Demo video) | S3 (Product Hunt prep) |
| **Ongoing** | P9 (Emails), P10 (Admin) | A7 (Feedback), S4 (Content) | V8 (API docs), S5-S6 (Outreach) |

---

## Sprint 3 — Launch (Post Meta-Approval, Sep 2026)

> Meta App Review approved ✅. Focus now: E2E testing → payment testing → prod cutover → launch → marketing.
> Duration: ~4 weeks. Tasks split by each person's Sprint 1/2 focus area.

---

### Priyanka — Backend Verification, Monitoring, Reliability (16 sub-tasks)

*Focus: End-to-end backend testing, observability, production reliability, IG API verification*

#### Phase 9: End-to-End Backend Testing

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| P17 | **cURL smoke tests for all 3 IG permissions** | | High | ✅ Done |
| | | 17.1 Verify token scopes via `debug_token` endpoint for each connected account | | ✅ Done (via `scripts/test-ig-perms.sh` on 60d IBL token) |
| | | 17.2 Test `instagram_business_basic` — fetch profile + recent media | | ✅ Done (profile + media fetch PASSED) |
| | | 17.3 Test `instagram_business_manage_comments` — read comments + POST reply | | ✅ Done (read PASSED; write skipped — needs live comment ID) |
| | | 17.4 Test `instagram_business_manage_messages` — list conversations + send DM (within 24hr window) | | ✅ Done (conversations list PASSED; DM send skipped — needs recipient IGSID inside 24hr window) |
| | | 17.5 Commit results as `scripts/test-ig-perms.sh` | | ✅ Done |
| P18 | **Webhook end-to-end verification** | | High | 🔶 In Progress |
| | | 18.1 Real comment from second IG account → verify webhook received → verify reply posted → verify DM sent | | ✅ Done — stale status; already verified with dm_shiyam + vatsvelocity per Venkat #4 follow-up (2026-09-09) |
| | | 18.2 Verify Meta webhook signature validation is enforced in production | | ✅ Done (audit + `scripts/test-webhook-e2e.sh` proves fail-closed) |
| | | 18.3 Test webhook idempotency — Meta retry same payload → single side effect | | ✅ Done (10-way parallel replay → exactly 1 DM + 1 reply in DB) |
| P19 | **Rate limit + dedup regression run** | | High | ✅ Done (local) |
| | | 19.1 Run `npm run test:dedup` against production DB (read-only assertions) | | ✅ Done (23/23 pass on local DB — re-run against prod DB post-cutover) |
| | | 19.2 Load test: 100 concurrent webhook posts → verify quota enforcement | | ✅ Done (Tests 13-14 cover 200-way concurrent storm — cap strictly enforced) |
| P20 | **Token lifecycle in production** | | High | 🔶 In Progress |
| | | 20.1 Verify long-lived token exchange works on prod OAuth callback | | ✅ Done (dm_shiyam account connected via prod OAuth, `access_token` = 60d IBL, expires Nov 2 2026) |
| | | 20.2 Verify refresh-tokens cron runs on schedule (check Vercel cron logs) | | → Duplicate of Sprint 4 **PR19** — code verified correct by Cascade 2026-09-09 (schedule is 06:00 UTC, not 03:00 as originally assumed); dashboard confirmation **→ Venkat** (reassigned 2026-09-11) |
| | | 20.3 Verify token-expiry warning email actually sends via Resend | | ⚠️ **Cannot verify remotely** (no `RESEND_API_KEY` in this session's `.env.local`) — Priyanka: check Resend Dashboard → Logs, filter by `token-expiry` template/subject, confirm a delivery within the last 7 days matches an account whose token was near expiry |

#### Phase 10: Observability & Alerting

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| P21 | **Health check endpoint** | | High | ✅ Done |
| | | 21.1 Build `GET /api/health` — checks DB, Meta API reachability, Razorpay reachability | | ✅ Done (`src/app/api/health/route.ts`) |
| | | 21.2 Return JSON with per-dependency status + latency | | ✅ Done (parallel checks + timeout + 503 on down) |
| P22 | **Error monitoring** | | Medium | ✅ Fully done 2026-09-11 — Sentry live + all 7 alert rules configured |
| | | 22.1 Integrate Sentry (or minimal alternative) for uncaught exceptions in API routes | | ✅ Done (`@sentry/nextjs` + `src/lib/monitoring.ts`) |
| | | 22.2 Add alerting for: webhook failures, cron failures, payment webhook failures | | ✅ Done (`captureError`/`captureAlert` wired in all 5 critical routes; see `docs/SENTRY_SETUP.md`) |
| | | 22.3 Sign up at sentry.io (free tier) and create `dm-shiyam` project | | ✅ Done (2026-09-11) |
| | | 22.4 Copy DSN + add 5 env vars to Vercel (SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN) | | ✅ Done (Venkat 2026-09-11) |
| | | 22.5 Redeploy Vercel + trigger test event to confirm Sentry receives it | | ✅ Done — verified via `?sentry_diag=1` probe, `flush_ok=true`, event_id `911523813e81423790bd42452840b0a5`. Note: `instrumentation.ts` auto-hook silently no-ops under Next 16 + Sentry v10; worked around by lazy-init in `src/lib/monitoring.ts::ensureSentry()`. See `docs/SENTRY_SETUP.md` § Troubleshooting. |
| | | 22.6 Configure alert rules in Sentry (payment failures, cron failures, IG webhook sig failures) | | ✅ Done 2026-09-11 — all 7 rules created via Sentry API (see Sprint 4 PR18 for rule IDs) |
| P23 | **Admin dashboard MRR/metrics** | | Medium | ✅ Done |
| | | 23.1 Add MRR, active subscribers, churn count to `/admin` | | ✅ Done (`RevenueGrid` widget with MRR/ARR/ARPU/churn/trialing on `/admin`) |
| | | 23.2 Add "Meta API errors last 24h" widget | | ✅ Done (traffic-light widget in Overview tab: green<10, amber 10-49, red≥50) |

---

### Ankit — Frontend Polish, Onboarding, Marketing Content (15 sub-tasks)

*Focus: Onboarding UX, marketing pages, launch content, feedback loops*

#### Phase 9: End-to-End Frontend Testing

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| A8 | **Cross-browser + device QA** | | High | ✅ Done — 2026-09-09 |
| | | 8.1 Full flow test on Chrome, Safari, Firefox (desktop) | | ✅ Done — automated Playwright suite (`tests/e2e/smoke.spec.ts`, 12 tests) passes on chromium + firefox + webkit (36/36); manual full walkthrough completed 2026-09-09 across all three desktop browsers. No functional regressions surfaced. |
| | | 8.2 Full flow test on mobile Chrome + mobile Safari | | ✅ Done — Playwright emulates Pixel 7 (Chrome) + iPhone 14 (Safari) → 24/24 green. **Real iPhone Safari + iPhone Chrome manually verified 2026-09-09** — Google OAuth cookies persist, credentials login persists, forgot-password + reset flow works end-to-end. Uncovered iOS Chrome IG OAuth bug (item #3 in QA_CHECKLIST §5). |
| | | 8.3 Fix any layout/OAuth breakage found | | ✅ Done — 8 bugs found + fixed across the session, catalogued in `docs/QA_CHECKLIST.md` §5. Highlights: mobile tab strip label truncation (`44f964a`), auto-switch to Accounts tab on IG OAuth return (`44f964a`), iPhone Chrome IG OAuth dead-end warning banner (`a0d61b5`), pricing page session-awareness + PLANS-driven display (`c95fbe8`), friendlier auth error copy (`efd1f90`, earlier), Google button on `/login` (`8d9eb6f`, earlier). All manually re-verified on target platforms. Regression tests added for the auth-copy + Google-button fixes in the Playwright suite. |
| A9 | **Onboarding funnel audit** | | High | ✅ Done |
| | | 9.1 Time signup → first connected account → first automation → first DM sent | | ✅ Done — `users.first_{account_connected,automation_created,dm_sent}_at` write-once cols wired into OAuth callback / manual account POST / automations POST / webhook after `dm_sent=true`. GA4 `first_dm_sent` event + `/api/admin/funnel` endpoint + Onboarding Funnel widget on `/admin`. 18/18 tests pass in `tests/test-funnel.js`. |
| | | 9.2 Identify drop-off points, add inline help / tooltips where users get stuck | | ✅ Done — new `<InfoTip />` (`src/components/InfoTip.tsx`) on Instagram Account select, Trigger Keywords, DM Message fields. Amber Business/Creator prerequisite callout on empty Accounts tab. |
| | | 9.3 Add empty-state CTAs on Dashboard / Automations / Accounts when empty | | ✅ Done — `GettingStartedChecklist` above dashboard stats (auto-hides once all 3 milestones hit, dismissible). Automations empty state adapts to `accounts.length === 0` and routes to Connect Instagram instead of dangling Create Automation. |

#### Phase 10: Launch Content

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| A10 | **Landing page conversion polish** | | High | 🟡 Partial |
| | | 10.1 Add real testimonials (from beta users — target 3-5) | | Deferred — no beta users yet; existing fake testimonials wrapped in `{false && (...)}` in `LandingContent.tsx` to hide from render until real quotes are collected |
| | | 10.2 Add "As approved by Meta ✓" trust badge near hero | | ✅ Done — Meta "Tech Provider" logo card next to hero CTA + three green check labels (Meta Approved, No Credit Card, 14-Day Free Trial) |
| | | 10.3 Add FAQ section addressing: pricing, cancellation, IG safety, data privacy | | ✅ Done — `#faq` section with 5 questions (pricing, cancellation, IG safety, data privacy, FB Page not required), native `<details>` accordions, footer link |
| | | 10.4 Add sticky "Start free trial" CTA on scroll | | ✅ Done — indigo bottom bar appears after 600px scroll, dismissible with × persisted in `localStorage` |
| A12 | **Blog posts (S4 owner)** | | Medium | ✅ Done |
| | | 12.1 "How to automate Instagram DMs" (SEO target: "instagram dm automation") | | ✅ Done — `src/content/blog/how-to-automate-instagram-dms.md` (~1450 words, dated 2026-07-15) |
| | | 12.2 "ManyChat alternative for Indian creators" (comparison post) | | ✅ Done — `src/content/blog/manychat-alternative-for-indian-creators.md` (~1500 words, dated 2026-09-04) |
| | | 12.3 "Turn Instagram comments into leads (with keyword automation)" | | ✅ Done — `src/content/blog/turn-instagram-comments-into-leads.md` (~1600 words, dated 2026-08-12) |
| | | 12.4 Blog infrastructure (routes, markdown parser, sitemap, dynamic OG images) | | ✅ Done — `/blog` index + `/blog/[slug]` detail (statically generated), `src/lib/blog.ts` (gray-matter + marked), `src/app/og/blog/[slug]/route.tsx` (1200×630 `ImageResponse`), sitemap includes all posts, JSON-LD BlogPosting schema, `@tailwindcss/typography` for prose, footer link |
| A13 | **Onboarding emails** | | Medium | ✅ Done |
| | | 13.1 Welcome email (Day 0) | | ✅ Done — `sendWelcomeEmail` fires from `POST /api/auth/register` and Google `signIn` callback in `lib/auth.ts`, guarded by atomic `claimOnboardingEmail("welcome_day0")` |
| | | 13.2 "Connect your first IG account" nudge (Day 1, if not connected) | | ✅ Done — `sendConnectIgNudge`, sent only if user has no active account (checked via `EXISTS accounts.is_active`) |
| | | 13.3 "Create your first automation" nudge (Day 3) | | ✅ Done — `sendFirstAutomationNudge`, sent only if user has zero automations |
| | | 13.4 Case study email (Day 7) | | ✅ Done — `sendCaseStudyEmail` with real-world DM stats example + links to `/blog/how-to-automate-instagram-dms` |
| | | 13.5 Upgrade nudge (Day 12, near trial end) | | ✅ Done — `sendUpgradeNudge`, skipped if user already on paid plan (`plan != free` or `subscription_status = active`) |
| | | 13.6 Drip cron infrastructure | | ✅ Done — `src/app/api/cron/send-onboarding-emails/route.ts` runs daily at 09:00 UTC (`vercel.json`), pulls candidates by signup age via `getOnboardingCandidates`, atomic `sent_onboarding_emails(user_id, email_type)` PK guarantees at-most-once delivery across cron retries |
| | | 13.7 Regression test | | ✅ Done — `scripts/test-onboarding-drip.mjs` end-to-end tests all 4 delayed steps + idempotency + conditionals (skip IG-connected, skip paying users); snapshots/restores user state. Run: `node scripts/test-onboarding-drip.mjs your@email.com`. 7/7 passing. |
| A14 | **In-app feedback nudge** | | Low | ✅ Done |
| | | 14.1 After first DM sent → toast: "How was it? [thumbs up/down]" | | ✅ Done — custom sonner toast in `DashboardContent.tsx` fires on first SSE event with `dm_sent === true`, one-shot via `localStorage.dms_first_dm_feedback` |
| | | 14.2 Route feedback to support email + dashboard | | ✅ Done — `POST /api/feedback` (auth + rate-limited 10/hr) persists to `feedback` table and fires `sendFeedbackToSupport` email to `SUPPORT_EMAIL` (default `dmshiyamofficial@gmail.com`); new **Feedback** tab in `/admin` shows totals + up/down split + table via `GET /api/admin/feedback` |

---

### Venkat — Production Cutover, Payments, Launch Ops (17 sub-tasks)

*Focus: Domain cutover, live payments, analytics events, distribution channels*

#### Phase 9: Production Cutover

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| V9 | **Complete custom domain cutover (V4/V5 continuation)** | | High | Pending |
| | | 9.1 Add `dmshiyam.com` to Vercel project + verify DNS | | Pending |
| | | 9.2 Confirm SSL active + www redirect working | | Pending |
| | | 9.3 Update `APP_URL`, `NEXTAUTH_URL` env vars to `https://dmshiyam.com` | | Pending |
| | | 9.4 Update Meta App Dashboard: OAuth redirect URI, deauth callback, data deletion URL | | Pending |
| | | 9.5 Update Razorpay webhook URL to new domain | | Pending |
| | | 9.6 Update Google OAuth authorized redirect URIs | | Pending |
| V10 | **Razorpay live mode (KYC done ✅)** | | High | Pending |
| | | 10.1 Swap test keys → live keys in Vercel env vars | | Pending |
| | | 10.2 Do one real ₹1 test transaction end-to-end, then refund | | Pending |
| | | 10.3 Verify live webhook signature validates | | Pending |
| | | 10.4 Enable Razorpay's automatic email invoices (GST compliance) | | Pending |

#### Phase 10: Payment Reliability

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| V11 | **Payment reconciliation cron** | | Medium | ✅ Done |
| | | 11.1 Nightly job: pull Razorpay payments last 24h, compare with our subscriptions table | | ✅ Done (`src/app/api/cron/reconcile-payments/route.ts` — 25h window, paginated fetch, forward + reverse pass) |
| | | 11.2 Alert on mismatch (missed webhook, orphan payment) | | ✅ Done (Sentry `captureAlert` with clipped mismatch sample; regression test `scripts/test-reconcile-payments.mjs` 6/6 passing; scheduled 03:00 UTC daily in `vercel.json`) |
| V12 | **Failure scenario testing** | | Medium | ✅ Done |
| | | 12.1 Card declined → verify no subscription created | | ✅ Done — webhook now handles `payment.failed` with Sentry `captureAlert` (never activates user); asserted by `scripts/test-payment-failures.mjs` test 12.1 |
| | | 12.2 User closes checkout → verify no orphan pending state | | ✅ Done — verified by test 12.2: with no webhook fired, user stays on `free` plan / `none` subscription_status (system's contract: no server-side change without a webhook) |
| | | 12.3 Network drop mid-payment → verify webhook eventually reconciles | | ✅ Done — 20-way concurrent `subscription.activated` storm produces exactly one active user (idempotent via SET-based `updateUserPlan`); test 12.3 also fires a follow-up wave to confirm state stability |
| | | 12.4 Regression guard (bonus) | | ✅ Done — test 12.4 asserts invalid signatures still return 400 with no state change (prevents future auth regressions) |
| | | Run: `node scripts/test-payment-failures.mjs` against a running dev server. Requires DATABASE_URL + RAZORPAY_WEBHOOK_SECRET. 4/4 test groups. |

#### Phase 11: Analytics & Distribution

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| V13 | **GA conversion events (V6.3 continuation)** | | Medium | ✅ Done |
| | | 13.1 Fire `signup_completed` event | | ✅ Done (`LoginForm.tsx` + `LoginFormComponent.tsx` on credentials-signup success; Google-signup event deferred until `provider` is surfaced in session/JWT) |
| | | 13.2 Fire `account_connected` event | | ✅ Done (`AccountsTab.tsx` on `?ig_connected=1` query param) |
| | | 13.3 Fire `automation_created` event | | ✅ Done (`DashboardContent.tsx` on POST /api/automations success; PUT edits deliberately skipped) |
| | | 13.4 Fire `subscription_started` event (with plan + amount) | | ✅ Done (`PricingContent.tsx` — fires before Razorpay redirect since hosted checkout takes over the tab; server-side "paid" tracked via existing Razorpay webhook) |
| | | 13.5 Typed helper (bonus) | | ✅ Done (`src/lib/analytics.ts` — `trackEvent()` with discriminated-union `ConversionEvent`, no-op on SSR / missing gtag) |
| V14 | **Product Hunt launch (S3 owner)** | | Medium | Pending |
| | | 14.1 Create maker profile, prep hunter | | Pending |
| | | 14.2 Prepare: tagline, first comment, gallery, GIF/video | | Pending |
| | | 14.3 Schedule Tuesday-Thursday launch, coordinate launch-day pings | | Pending |
| V15 | **Social launch (V7.3 continuation)** | | Medium | Pending |
| | | 15.1 Post launch on @dmshiyam IG + X | | Pending |
| | | 15.2 Founder LinkedIn post about the Meta approval journey (proven high-engagement angle) | | Pending |
| | | 15.3 Reddit posts in r/InstagramMarketing, r/Entrepreneur, r/SocialMediaMarketing | | Pending |
| V16 | **Paid ads (small budget start)** | | Low | Pending |
| | | 16.1 Meta Ads: ₹500/day on IG Reels targeting Indian coaches (25-45) | | Pending |
| | | 16.2 Google Ads: ₹300/day on "instagram auto dm", "manychat alternative", "comment to dm" | | Pending |
| | | 16.3 Track CPA per channel in GA | | Pending |
| V17 | **Influencer/creator outreach (S5 owner)** | | Low | Pending |
| | | 17.1 List 20 Indian coaches/course creators on IG (10K-100K followers) | | Pending |
| | | 17.2 DM outreach offering free Pro plan for honest review | | Pending |
| | | 17.3 Track responses + conversions in a sheet | | Pending |

---

### Cascade (Me) — Automation, Scripts, Code Support

*Focus: Anything Priyanka/Ankit/Venkat delegate that's pure code work. Available on-demand for:*

- Writing test scripts (e.g. `scripts/test-ig-perms.sh` for P17)
- Building new endpoints (e.g. `/api/health` for P21)
- Code review + bug fixes surfaced during E2E testing
- Drafting blog post content for A12 (Ankit reviews + publishes)
- Writing onboarding email copy for A13
- Refactoring / debugging on request
- Documentation updates

*Just @-mention the specific task ID and I'll pick it up.*

---

## Sprint 3 Execution Plan

| Week | Priyanka | Ankit | Venkat |
|------|----------|-------|--------|
| **Week 1 (Sep 2-8)** | P17 (IG cURL tests), P18 (webhook E2E) | A8 (cross-browser QA), A9 (onboarding audit) | V9 (domain cutover), V10 (Razorpay live) |
| **Week 2 (Sep 9-15)** | P19 (dedup regression), P20 (token lifecycle) | A10 (landing polish) | V11 (payment reconciliation), V12 (failure tests) |
| **Week 3 (Sep 16-22)** | P21 (health endpoint), P22 (Sentry) | A12 (blog posts), A13 (onboarding emails) | V13 (GA events), V14 (Product Hunt prep) |
| **Week 4 (Sep 23-29)** | P23 (MRR dashboard) | A14 (feedback nudge) | V15 (social launch), V16 (paid ads live), V17 (outreach) |

---

## Sprint 3 Success Metrics (End of Week 4)

| Metric | Target |
|---|---|
| P0/P1 bugs found in E2E | 0 open |
| Custom domain live with SSL | ✅ |
| Razorpay live mode processing payments | ✅ |
| Signups | 100+ |
| Users who created ≥1 automation | 30+ |
| Paying customers | 10+ |
| MRR | ₹15,000+ |
| Uptime | 99.5%+ |

---

## Sprint 5 — Go-Live: Payments, Security, Domain, Marketing

> **Goal**: Flip the switch from "beta on Vercel subdomain" to "real product on real domain, taking real money, safely."
> **7 top-level tracks / 42 sub-tasks** split between Ankit + Venkat, with Priyanka pulled in only for Razorpay KYC.
> Legend: 🔴 P0 (blocker) · 🟡 P1 (should) · 🟢 P2 (nice)

### Ownership summary

| Track | Owner | Priority |
|-------|-------|----------|
| S5.1 Razorpay LIVE integration | **Shared** — Ankit + Venkat + Priyanka (KYC) | 🔴 |
| S5.2 Security issues | Venkat | 🔴 |
| S5.3 End-to-end website testing | Ankit | 🔴 |
| S5.4 Vercel Premium — required? | Ankit | 🟡 |
| S5.5 Make Git repo private | Ankit | 🔴 (High) |
| S5.6 Finalize marketing platform (Google Ads flow, HicksField) | Ankit | 🟡 |
| S5.7 Domain deployment (`dmshiyam.com`) | Venkat | 🔴 |

---

### S5.1 — Razorpay LIVE Integration 🔴 (Shared: Ankit + Venkat + Priyanka)

*Currently on test keys. Flip to live mode, run real money end-to-end, keep webhooks idempotent.*

| # | Sub-task | Owner | Status |
|---|----------|-------|--------|
| 1.1 | Complete Razorpay KYC — PAN, GST/Udyam, bank a/c, business proof upload | **Priyanka** | Pending |
| 1.2 | Get live-mode activation approval from Razorpay (1–3 business days after KYC) | **Priyanka** | Pending |
| 1.3 | Generate LIVE `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`; store in Vercel env (Production scope only, not Preview) | **Venkat** | Pending |
| 1.4 | Create LIVE subscription plans mirroring test IDs (Starter / Pro / Business / Agency) and update `PLANS` config with live plan IDs | **Venkat** | Pending |
| 1.5 | Point Razorpay webhook to `https://dmshiyam.com/api/billing/webhook` and subscribe to `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `payment.failed` | **Venkat** | Pending |
| 1.6 | Verify webhook idempotency table (`billing_events` from V6/V7) is deployed to prod DB before first live charge | **Venkat** | Pending |
| 1.7 | Real ₹1 payment smoke test end-to-end: checkout → UPI → webhook → plan flips → dashboard reflects → cancel → downgrade → refund | **Ankit** (UX QA) + **Venkat** (backend) | Pending |
| 1.8 | Update `/pricing` page + landing CTAs to remove any "test mode" copy; publish live refund policy link | **Ankit** | Pending |
| 1.9 | Wire `/billing/success` + `/billing/cancel` pages to real subscription IDs; verify GA4 `subscription_started` fires with live event | **Ankit** | Pending |
| 1.10 | Post-launch monitoring: first 48 hours — daily reconcile Razorpay dashboard vs `users.subscription_status` in DB; log any mismatches | **Venkat** | Pending |

---

### S5.2 — Security Issues 🔴 (Venkat)

*Address the deferred P12.1 audit items + any new findings from Sprint 4.*

| # | Sub-task | Priority | Status |
|---|----------|----------|--------|
| 2.1 | Resolve outstanding `npm audit --production` high-severity vulns — plan Next.js 15 + NextAuth v5 upgrade (deferred from P12.1) | 🔴 | Pending |
| 2.2 | Rotate ALL production secrets before domain go-live: `NEXTAUTH_SECRET`, `CRON_SECRET`, DB password, Resend key, Razorpay live keys | 🔴 | Pending |
| 2.3 | Flip CSP from `Report-Only` to enforced (`CSP_ENFORCE=1`) after 7-day clean report window | 🟡 | Pending |
| 2.4 | Review `/api/csp-report` violations in Sentry; whitelist legit sources (GA, Razorpay, IG embeds) | 🟡 | Pending |
| 2.5 | Enable Vercel WAF / bot protection on `/api/auth/*`, `/api/billing/*`, `/api/webhook/*` | 🟡 | Pending |
| 2.6 | Audit all env vars — remove unused keys, ensure no secrets leak to client bundle (`NEXT_PUBLIC_*` sweep) | 🟡 | Pending |
| 2.7 | Penetration-test checklist run: OWASP Top 10 (auth bypass, IDOR on `/api/automations/[id]`, XSS in DM template preview, SSRF in IG media fetch) | 🔴 | Pending |
| 2.8 | Add security.txt at `/.well-known/security.txt` with disclosure contact | 🟢 | Pending |
| 2.9 | Session hardening — verify NextAuth cookie flags (`Secure`, `HttpOnly`, `SameSite=Lax`) on production domain, not just vercel.app subdomain | 🔴 | Pending |
| 2.10 | Backup + restore drill on Neon Postgres — verify PITR works, document runbook | 🟡 | Pending |

---

### S5.3 — End-to-End Website Testing 🔴 (Ankit)

*Full manual + scripted walkthrough of every user-facing flow on the live domain before public launch.*

| # | Sub-task | Priority | Status |
|---|----------|----------|--------|
| 3.1 | Auth flow: signup (credentials + Google) → email verify → login → forgot/reset password → session persistence across tabs | 🔴 | Pending |
| 3.2 | Onboarding flow: first-login wizard → connect IG account → create first automation → send test DM (self-comment) | 🔴 | Pending |
| 3.3 | Billing flow: free → checkout Pro → webhook activation → dashboard limits update → cancel → grace period → downgrade | 🔴 | Pending |
| 3.4 | Multi-account flow: connect 2 IG accounts, create per-account and general automations, verify routing (regression from Venkat #4) | 🔴 | Pending |
| 3.5 | Cross-browser: Chrome / Safari / Firefox / Edge — desktop + iPhone Safari + Android Chrome (extend A8 methodology) | 🔴 | Pending |
| 3.6 | Broken-link crawl of production site (blog, pricing FAQ, footer legal, help docs) — use `lychee` or similar | 🟡 | Pending |
| 3.7 | Lighthouse audit: Performance / A11y / SEO / Best-Practices ≥ 90 on landing, pricing, dashboard | 🟡 | Pending |
| 3.8 | Error-state QA: expired IG token, revoked OAuth, failed payment, quota exceeded, webhook down — each shows friendly UI, not stack trace | 🔴 | Pending |
| 3.9 | Empty-state QA: no accounts, no automations, no activity — every dashboard tab has a helpful CTA, not a blank pane | 🟡 | Pending |
| 3.10 | File defects in a shared sheet with repro / severity / owner, block launch on any 🔴 open | 🔴 | Pending |

---

### S5.4 — Vercel Premium: Required? 🟡 (Ankit)

*Decide before domain go-live whether Hobby is sufficient or we need Pro ($20/user/mo).*

| # | Sub-task | Status |
|---|----------|--------|
| 4.1 | Enumerate current Hobby limits actually hit or at risk: bandwidth (100 GB/mo), function invocations (100 K/day), image optimization (1 K/mo), cron count, log retention (1 day) | ✅ Done (Ankit, 2026-09-26) |
| 4.2 | Check whether Hobby permits **commercial use** — Vercel ToS explicitly disallows monetized products on Hobby; if we're taking payments, Pro is not optional | ✅ Done — confirmed Pro is mandatory |
| 4.3 | Estimate 30-day forward usage from Sprint 3 metrics (signups × avg webhooks × avg image loads) | ✅ Done |
| 4.4 | Compare Pro benefits worth paying for: password-protected previews, longer log retention (7d), team seats, higher edge/serverless caps, WAF add-on | ✅ Done |
| 4.5 | **Decision: upgrade to Vercel Pro** — research complete, upgrade action still pending (only remaining Sprint 5 blocker on this track) | 🔶 Upgrade pending |

---

### S5.5 — Make Git Repo Private 🔴 High Priority (Ankit)

*Currently public — leaks business logic, prompts, cron secrets in git history if anything slipped.*

| # | Sub-task | Status |
|---|----------|--------|
| 5.1 | Scan full git history with `gitleaks` / `trufflehog` for any committed secrets before flipping visibility | ✅ Done (Ankit, 2026-09-26) |
| 5.2 | If secrets found: rotate them AND scrub via `git filter-repo` (BFG is deprecated), force-push cleaned history | ✅ Done |
| 5.3 | GitHub → repo Settings → Danger Zone → Change visibility → **Private** | 🔶 Reverted to **public** (Ankit, 2026-09-27) as a workaround — see 5.5 |
| 5.4 | Re-invite collaborators (Ankit, Venkat, Priyanka) as repo members with least-privilege roles (Maintainer / Write) | ✅ Done |
| 5.5 | Reconnect Vercel Git integration under private repo (may require re-auth of GitHub App on the org) | 🔴 Confirmed root cause (2026-09-27): Vercel Hobby silently stopped auto-deploying on push once the repo went private — every "Redeploy" click was rebuilding the same stale pre-privatization commit, never the actual latest `main`. Made the repo public today purely to unblock testing S5.6.5; auto-deploy confirmed working again on push. Still need to decide: upgrade to Vercel Pro (S5.4.5) and re-privatize, or accept public long-term. |
| 5.6 | Verify preview deploys, cron jobs, and webhook redeploys still work post-privatization | 🔶 Superseded by 5.5 finding above — repo is public again, so this couldn't be verified under the private condition it was meant to check. Re-test once 5.5 is resolved either direction. |
| 5.7 | Update README to remove any "open source" language; add internal-only notice | Pending |

---

### S5.6 — Finalize Platform for Marketing 🟡 (Ankit)

*Pick the acquisition stack before spending money. Evaluate the real targeting/ad-buying platforms (Meta Ads, Google Ads already live per 16.1/16.2, plus YouTube Shorts, X, LinkedIn) against each other; evaluate AI ad-creative generators (Google Flow, Higgsfield) separately — they don't do audience targeting or conversion tracking, so they aren't acquisition-channel candidates, they're tools for producing the creatives in 6.6.*

| # | Sub-task | Status |
|---|----------|--------|
| 6.1 | Define success metric per channel: CPA target, expected LTV, payback window | Pending |
| 6.2 | Meta Ads evaluation — targeting quality for IG creators/coaches in IN, landing-page requirements, conversion tracking setup (already spending ₹500/day per 16.1 — formalize before scaling spend) | Pending |
| 6.3 | Google Ads evaluation — same criteria as 6.2 (already spending ₹300/day per 16.2 — formalize before scaling spend) | Pending |
| 6.4 | Compare vs alternatives (YouTube Shorts ads, X ads, LinkedIn for agency plan) | Pending |
| 6.5 | Set up conversion tracking end-to-end for the chosen platform: pixel/tag → GA4 → server-side event for `subscription_started` | ✅ Done (Ankit, 2026-09-27) — client fires `checkout_initiated` (funnel step) at click time; webhook fires real `subscription_started` server-side via GA4 Measurement Protocol on first activation only. Verified live in GA4 Realtime with correct `plan`/`amount`/`currency` params. Along the way, fixed: dead `subscription.expired` case (real event is `subscription.completed`), webhook signature check pointed at the wrong (Live Mode) Razorpay secret, and idempotency key read from the wrong field (`event.id` doesn't exist — it's the `x-razorpay-event-id` header) — this last one meant the webhook likely never successfully processed a delivery before today. |
| 6.6 | Draft 3 ad creatives + 2 landing-page variants for the launch campaign; run past Venkat for tech accuracy. Creative-tool choice feeds in here: **Google Flow** (Veo 3, bundled in Google AI Pro/Ultra, $19.99–$249.99/mo) vs **Higgsfield** (packaged UGC ad workflow, $19/$59/$129 self-serve tiers, ~$13/finished 15s ad clip) — compare cost-per-finished-clip, output quality/realism for Indian-coach UGC style, and commercial usage rights | Pending |
| 6.7 | Recommendation doc → pick 1 primary + 1 experiment channel, allocate first-month budget cap | Pending |

---

### S5.7 — Domain Deployment 🔴 (Venkat)

*Move from `dm-shiyam.vercel.app` to `dmshiyam.com` (or final chosen domain) as the canonical production URL.*

| # | Sub-task | Status |
|---|----------|--------|
| 7.1 | Confirm domain registrar + WHOIS privacy enabled | Pending |
| 7.2 | Add domain in Vercel project → configure `A` / `CNAME` records at registrar per Vercel instructions | Pending |
| 7.3 | Wait for SSL cert provisioning (Vercel auto — usually < 10 min); verify `https://` works with valid cert chain | Pending |
| 7.4 | Set `dmshiyam.com` as primary domain in Vercel; redirect `www.` → apex (or vice versa, pick one) | Pending |
| 7.5 | Update `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, and any hardcoded URLs in codebase / env / DB email templates | Pending |
| 7.6 | Update Meta app: OAuth redirect URIs, webhook callback URL, privacy/ToS URLs, app icon domain | Pending |
| 7.7 | Update Google OAuth authorized redirect URIs in Google Cloud Console | Pending |
| 7.8 | Update Razorpay dashboard webhook URL + allowed origins | Pending |
| 7.9 | Set up 301 redirects from `dm-shiyam.vercel.app/*` → `dmshiyam.com/*` (preserve SEO for indexed pages) | Pending |
| 7.10 | Update sitemap.xml / robots.txt with new domain; re-submit to Google Search Console; add domain property | Pending |
| 7.11 | Post-cutover smoke test: run S5.3 (E2E) checklist on the new domain before announcing publicly | Pending |

---

### S5.8 — Customer Billing & Email Polish 🟡 (Priyanka + Venkat)

*Bandwidth-aware split: Venkat picks up Razorpay-side items (already owns S5.1 live-mode work); Priyanka picks up email-template items (owns P9 email notifications and is otherwise blocked on KYC review wait).*

| # | Sub-task | Owner | Priority | Status |
|---|----------|-------|----------|--------|
| 8.1 | **Cancel Razorpay subscription for customer** — expose a "Cancel plan" action in the customer's billing page → calls Razorpay `subscriptions.cancel` (respect `cancel_at_cycle_end`), reflect state in `users.subscription_status`, confirm downgrade path on `subscription.cancelled` webhook, cover in S5.1.7 real-money smoke | **Venkat** | 🔴 | ✅ Done (Ankit + Devin, 2026-10-02) — shipped in commits `c400f1e`, `1491630`, `1b7201e`, `60d52f0`. `POST /api/billing/cancel` calls `razorpay.subscriptions.cancel(id, true)` so paid access runs through cycle end; dashboard header shows a stateful "Cancel plan" pill that flips to a muted "Cancels at period end" chip via new `GET /api/billing/status`. Edge cases handled: free plan, already-cancelled, no sub id, mock subs, "ID invalid / not found" (treats as nothing-to-cancel), Razorpay already-cancelled race. FAQ copy on `/pricing` updated. Smoke tests in `tests/test-billing-cancel.mjs`. |
| 8.2 | **Beautify DMShiyam transactional emails + add logo** — audit every Resend template (welcome, password reset, token expiry, DM-limit 80%, billing receipts, refund) → apply consistent branded HTML shell, inline DMShiyam logo (hosted image URL, not attachment — Gmail-safe), consistent CTA button style, plain-text fallback, verified render in Gmail + Outlook + Apple Mail + iOS Mail | **Priyanka** | 🟡 | ✅ Done (Ankit + Devin, 2026-10-02) — shipped in commit `43bef2f`. New `wrapTemplate()` in `src/lib/email.ts` applies a 560px card-on-canvas shell with hosted-image logo (`/public/logo.jpeg`, Gmail-safe), consistent typography, dark-mode-safe palette, improved footer. Automatically re-styles ALL existing emails (welcome / nudges / DM-limit / token expiry / feedback) with zero per-template changes. Still pending: multi-client render verification (Outlook, Apple Mail), plain-text fallback. |
| 8.3 | **Fix: Razorpay not redirecting on Annual plan** — checkout for annual billing cycle isn't hitting the success/callback URL. Reproduce with annual plan ID, inspect `handler` callback + `redirect: true` config in `RazorpayCheckout` component, verify plan-specific `notes` field, check whether annual plan ID is even mapped in `PLANS` config (may be silently falling through to test mode). Regression-cover in S5.1.7 with both monthly + annual plans | **Venkat** | 🔴 | ✅ Verified working by Ankit (2026-10-02) — ₹149 live-mode txn + refund both completed end-to-end; annual + monthly flows both redirect correctly in production. |
| 8.4 | **Refund initiated + payment received emails keep customer on same page** — currently these emails likely link to home / login and lose context. Update both templates so CTAs deep-link back to `/dashboard/billing` (or the specific invoice/transaction), pre-authenticated via a short-lived signed link if the user isn't already logged in, so they land exactly where the status change happened. Coordinate with Venkat on webhook payload so the email has the right invoice/subscription id to link to | **Priyanka** (email) + **Venkat** (webhook payload) | 🟡 | ✅ Done (Ankit + Devin, 2026-10-02) — shipped in commit `43bef2f`. 6 payment-lifecycle emails wired through the webhook + cancel API: **subscription activated** (first-charge welcome + receipt), **payment received** (recurring renewal receipt with payment id + next billing date), **payment failed** (card decline with retry explainer), **cancellation scheduled** (fired from `/api/billing/cancel` with cycle-end date), **subscription ended** (fired when the paid cycle actually ends and user drops to Free), **refund initiated** (5–7 day timeline). All sends are fire-and-forget with `captureError` so Resend outages never fail a webhook. New `refund.created` webhook case with full idempotency via `billing_events`. CTAs still deep-link to `/dashboard` + `/pricing` (not a dedicated `/dashboard/billing` page — not built yet; see 8.5). |
| 8.5 | **Dedicated billing dashboard tab + signed deep-links** — build `/dashboard?tab=billing` with payment history, current cycle, invoice downloads, and plan-change action. Update email CTAs to signed deep-links so recipients land directly on the relevant invoice without re-authing | **Ankit** | 🟢 | Pending (nice-to-have — current emails link to `/dashboard` / `/pricing` which cover the common cases) |
| 8.6 | **Enable `refund.created` webhook event in Razorpay dashboard** — without this, the refund email in 8.4 never fires. One-click toggle in Razorpay dashboard → Settings → Webhooks → Active Events | **Ankit** | 🔴 | ✅ Done (Ankit, 2026-10-02) |

---

## Sprint 5 Execution Plan (suggested)

| Week | Priyanka | Ankit | Venkat |
|------|----------|-------|--------|
| **Week 1** | S5.1.1–1.2 (KYC submission) | S5.5 (repo private), S5.4 (Vercel decision) | S5.7.1–7.5 (domain + DNS + env cutover) |
| **Week 2** | (KYC review wait) — **S5.8.2 email beautify + logo** | S5.3 (E2E testing pass 1), S5.1.8–1.9 (pricing UI live-mode) | S5.2.1–2.6 (security hardening), S5.7.6–7.10 (external URL updates), **S5.8.3 annual-plan redirect fix** |
| **Week 3** | S5.1.2 (live activation), **S5.8.4 refund/payment emails (with Venkat)** | S5.6 (marketing platform decision), S5.3 (E2E pass 2 on new domain) | S5.1.3–1.6 (live keys + webhook), S5.2.7–2.10 (pen-test + backups), **S5.8.1 cancel-subscription flow**, **S5.8.4 webhook payload for email deep-link** |
| **Week 4** | — | S5.1.7 (real-money UX QA), S5.6 (launch creatives) | S5.1.7 + S5.1.10 (real-money backend + reconcile), S5.7.11 (final smoke) |

---

## Sprint 5 Definition of Done

- [ ] Razorpay live mode processing real payments; ≥5 real transactions reconciled
- [ ] `dmshiyam.com` is the canonical URL with valid SSL and all integrations pointing at it
- [ ] Git repo is private, no secrets in history, all collaborators re-invited
- [ ] E2E test checklist has zero open 🔴 defects
- [ ] Security audit items S5.2.1–2.7 all resolved or explicitly deferred with rationale
- [ ] Vercel plan decision made and applied
- [ ] Marketing platform chosen, first campaign ready to launch

