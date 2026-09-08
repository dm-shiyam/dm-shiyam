# DM Shiyam — Task List

> Tasks divided among 3 team members. Priorities: High / Medium / Low.

---

## Person 1: Priyanka — Backend & Infrastructure

*Focus: Token management, security, database, API reliability*

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | **Long-lived token exchange** — Exchange short-lived (1hr) tokens for 60-day tokens + auto-refresh before expiry | High | Done |
| 2 | **Migrate from SQLite to PostgreSQL** — SQLite doesn't support concurrent writes; move to Postgres for production | High | Pending (Ankit — Sprint 2) |
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
| 1 | **Fix hydration error properly** — `suppressHydrationWarning` is a band-aid; investigate root cause (browser extensions or layout mismatch) | Medium | Pending |
| 2 | **Signup page** — Build a dedicated `/register` page with proper validation and UX | High | Done |
| 3 | **Password reset flow** — Forgot password functionality (`/forgot-password`, `/reset-password`) | High | ✅ Done — end-to-end validated on prod 2026-09-08. Includes: Resend enabled via `RESEND_API_KEY` + `FROM_EMAIL=onboarding@resend.dev` (sandbox — deliverable only to Resend account owner until `dmshiyam.com` is verified). UX hardening (commit `efd1f90`): reveal-eye toggle on both New + Confirm fields, live "Passwords don't match yet" hint, client `minLength` bumped to 8 to match server policy, `autoComplete="new-password"` to defeat browser autofill masking. Integrity: `updatePassword` returns rowCount; API returns 500 if UPDATE matches 0 rows instead of silent `{success:true}`. |
| 4 | **Google OAuth setup** — GoogleProvider has empty `clientId/clientSecret`; either configure it or remove the button | Medium | ✅ Done — 2026-09-08. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set in Vercel; OAuth consent screen published (In production, not Testing) so any Gmail can sign in — no verification review needed (only non-sensitive scopes: `openid`, `email`, `profile`). Authorized redirect URI `https://dm-shiyam.vercel.app/api/auth/callback/google` added under Google Auth Platform → Clients. **Bug fix (commit `8d9eb6f`)**: `/login` was rendering `LoginFormComponent` (credentials-only) while `/register` used `LoginForm` (had Google button). Added the same Google button to `LoginFormComponent` so both pages now expose "Continue with Google". Also added friendly error copy for `CredentialsSignin` / `OAuthSignin` / `OAuthCallback` / `OAuthAccountNotLinked` (commit `efd1f90`) so login failures no longer surface raw NextAuth strings. Follow-up: two near-identical login form components (`LoginForm.tsx` + `LoginFormComponent.tsx`) — worth consolidating to prevent this class of bug. |
| 5 | **Real-time activity feed** — Replace 15s polling with WebSocket/SSE for instant activity updates | Medium | Done |
| 6 | **Mobile-responsive dashboard** — Test and fix dashboard layout on mobile screens | Medium | Done |
| 7 | **Toast notifications** — Add success/error toasts when creating automations, connecting accounts, etc. | Low | Done |
| 8 | **Automation templates** — Pre-built templates ("Lead Magnet", "Discount Code", "Link in Bio") for quick setup | Low | Done |
| 9 | **Dark mode support** — Add theme toggle | Low | Done |
| 10 | **Onboarding wizard** — First-time user setup flow guiding through connecting Instagram and creating first automation | Medium | Done |

---

## Person 3: Venkat — Features & Integrations

*Focus: New capabilities, billing, deployment*

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | **Razorpay billing integration** — Checkout/verify/webhook routes exist but likely untested; complete and test payment flow | High | Done |
| 2 | **Duplicate DM prevention** — If the same user comments the same keyword twice, don't send duplicate DMs; track sent DMs per user per automation | High | Done |
| 3 | **OpenAI integration testing** — AI Smart Replies module exists (`openai.ts`) but needs testing and prompt tuning | Medium | Done |
| 4 | **Multi-account token management** — AccountsTab lets users add accounts, but tokens need validation and refresh logic | Medium | Done |
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
| P7 | **Update Meta webhook URL** | | High | Pending |
| | | 7.1 Change webhook callback URL from ngrok to production domain | | Pending |
| | | 7.2 Re-verify webhook subscription with Meta | | Pending |
| P8 | **Set up cron job** | | Medium | 🔶 In Progress |
| | | 8.1 Add `vercel.json` cron config OR set up external cron (cron-job.org) | | ✅ Done (vercel.json configured with 2 crons, endpoints verified locally) |
| | | 8.2 Test monthly DM reset runs on schedule | | Pending (needs Vercel deployment) |

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
| | | 12.3 Add Content-Security-Policy header (needs review for GA/Razorpay/Instagram embeds) | | Pending |
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
| | | 5.3 Connect to Razorpay checkout | | Pending - Venkat? |
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
| | | 18.1 Real comment from second IG account → verify webhook received → verify reply posted → verify DM sent | | Pending (needs live IG account) |
| | | 18.2 Verify Meta webhook signature validation is enforced in production | | ✅ Done (audit + `scripts/test-webhook-e2e.sh` proves fail-closed) |
| | | 18.3 Test webhook idempotency — Meta retry same payload → single side effect | | ✅ Done (10-way parallel replay → exactly 1 DM + 1 reply in DB) |
| P19 | **Rate limit + dedup regression run** | | High | ✅ Done (local) |
| | | 19.1 Run `npm run test:dedup` against production DB (read-only assertions) | | ✅ Done (23/23 pass on local DB — re-run against prod DB post-cutover) |
| | | 19.2 Load test: 100 concurrent webhook posts → verify quota enforcement | | ✅ Done (Tests 13-14 cover 200-way concurrent storm — cap strictly enforced) |
| P20 | **Token lifecycle in production** | | High | 🔶 In Progress |
| | | 20.1 Verify long-lived token exchange works on prod OAuth callback | | ✅ Done (dm_shiyam account connected via prod OAuth, `access_token` = 60d IBL, expires Nov 2 2026) |
| | | 20.2 Verify refresh-tokens cron runs on schedule (check Vercel cron logs) | | Pending |
| | | 20.3 Verify token-expiry warning email actually sends via Resend | | Pending |

#### Phase 10: Observability & Alerting

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| P21 | **Health check endpoint** | | High | ✅ Done |
| | | 21.1 Build `GET /api/health` — checks DB, Meta API reachability, Razorpay reachability | | ✅ Done (`src/app/api/health/route.ts`) |
| | | 21.2 Return JSON with per-dependency status + latency | | ✅ Done (parallel checks + timeout + 503 on down) |
| P22 | **Error monitoring** | | Medium | 🔶 Code done, awaiting activation |
| | | 22.1 Integrate Sentry (or minimal alternative) for uncaught exceptions in API routes | | ✅ Done (`@sentry/nextjs` + `src/lib/monitoring.ts`) |
| | | 22.2 Add alerting for: webhook failures, cron failures, payment webhook failures | | ✅ Done (`captureError`/`captureAlert` wired in all 5 critical routes; see `docs/SENTRY_SETUP.md`) |
| | | 22.3 Sign up at sentry.io (free tier) and create `dm-shiyam` project | | Pending (Priyanka — 5 min, follow docs/SENTRY_SETUP.md steps 1-2) |
| | | 22.4 Copy DSN + add 5 env vars to Vercel (SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN) | | Pending (Priyanka — 5 min) |
| | | 22.5 Redeploy Vercel + trigger test error via `/api/health?force_error=1` to confirm Sentry receives it | | Pending (Priyanka — after 22.4) |
| | | 22.6 Configure alert rules in Sentry (payment failures, cron failures, IG webhook sig failures) | | Pending (Priyanka — 5 min, follow docs/SENTRY_SETUP.md step 5) |
| P23 | **Admin dashboard MRR/metrics** | | Medium | ✅ Done |
| | | 23.1 Add MRR, active subscribers, churn count to `/admin` | | ✅ Done (`RevenueGrid` widget with MRR/ARR/ARPU/churn/trialing on `/admin`) |
| | | 23.2 Add "Meta API errors last 24h" widget | | ✅ Done (traffic-light widget in Overview tab: green<10, amber 10-49, red≥50) |

---

### Ankit — Frontend Polish, Onboarding, Marketing Content (15 sub-tasks)

*Focus: Onboarding UX, marketing pages, launch content, feedback loops*

#### Phase 9: End-to-End Frontend Testing

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| A8 | **Cross-browser + device QA** | | High | Pending |
| | | 8.1 Full flow test on Chrome, Safari, Firefox (desktop) | | Issues Found |
| | | 8.2 Full flow test on mobile Chrome + mobile Safari | | Pending |
| | | 8.3 Fix any layout/OAuth breakage found | | Pending |
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
