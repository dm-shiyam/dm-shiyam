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
| 3 | **Password reset flow** — Forgot password functionality (`/forgot-password`, `/reset-password`) | High | Done |
| 4 | **Google OAuth setup** — GoogleProvider has empty `clientId/clientSecret`; either configure it or remove the button | Medium | Pending |
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
| P4 | **Meta Access Verification** | | High | Pending |
| | | 4.1 Complete access verification in Meta App Dashboard | | Pending |
| P5 | **Meta App Review submission** | | High | Pending |
| | | 5.1 Paste description from `docs/META_APP_REVIEW.md` | | Pending |
| | | 5.2 Record 30-60 sec screencast (dashboard → comment → DM flow) | | Pending |
| | | 5.3 Answer Data Handling questionnaire (data usage, retention, deletion) | | Pending |
| | | 5.4 Submit and wait for approval (1-5 business days) | | Pending |

#### Phase 4: Production Backend

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| P6 | **Set up production Postgres** | | High | Pending |
| | | 6.1 Create free Postgres on Neon/Supabase | | Pending |
| | | 6.2 Run schema migrations on production DB | | Pending |
| | | 6.3 Verify all tables and indexes created | | Pending |
| P7 | **Update Meta webhook URL** | | High | Pending |
| | | 7.1 Change webhook callback URL from ngrok to production domain | | Pending |
| | | 7.2 Re-verify webhook subscription with Meta | | Pending |
| P8 | **Set up cron job** | | Medium | Pending |
| | | 8.1 Add `vercel.json` cron config OR set up external cron (cron-job.org) | | Pending |
| | | 8.2 Test monthly DM reset runs on schedule | | Pending |

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
| V1 | **Domain name** | | High | Pending |
| | | 1.1 Purchase domain (dmshiyam.com or dmshiyam.in) from Namecheap/GoDaddy/Cloudflare | | Pending |
| | | 1.2 Set up DNS records | | Pending |
| V2 | **Business email** | | Medium | ✅ Done |
| | | 2.1 Set up contact@dmshiyam.com (Zoho Mail free / Google Workspace) | | ✅ Done |
| | | 2.2 Add to Meta App Dashboard contact info | | Pending |

#### Phase 4: Production Deployment

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| V3 | **Deploy to Vercel** | | High | Pending |
| | | 3.1 Connect GitHub repo to Vercel | | Pending |
| | | 3.2 Configure build settings (Next.js framework) | | Pending |
| | | 3.3 Set up all environment variables in Vercel dashboard | | Pending |
| | | 3.4 Test deployment builds successfully | | Pending |
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
| | | 7.1 Create @dmshiyam Instagram account | | Pending |
| | | 7.2 Create @dmshiyam Twitter/X account | | In Progress |
| | | 7.3 Post launch announcement | | Pending |

#### Phase 6: Post-Launch

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| V8 | **API documentation** | | Low | ✅ Done |
| | | 8.1 Document API endpoints (Swagger/OpenAPI or Markdown) | | ✅ Done (docs/API.md) |
| | | 8.2 Host docs on website or GitHub Pages | | Pending |

---

### Shared Tasks (All 3)

| # | Task | Sub-tasks | Priority | Status |
|---|------|-----------|----------|--------|
| S1 | **End-to-end testing** | | High | Pending |
| | | 1.1 Test signup → login → connect IG → create automation → comment → DM | | Pending |
| | | 1.2 Test billing flow (Razorpay checkout → plan upgrade → DM limit increase) | | Pending |
| | | 1.3 Test edge cases (expired token, rate limit, duplicate comment) | | Pending |
| S2 | **Demo video** | | Medium | Pending |
| | | 2.1 Write script / storyboard | | Pending |
| | | 2.2 Screen record the full product flow | | Pending |
| | | 2.3 Edit and upload to YouTube / landing page | | Pending |
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
