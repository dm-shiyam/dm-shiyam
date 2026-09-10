# DM Shiyam — Sprint 4: Production-Grade Launch

> **Goal**: Ship a polished, cohesive, production-ready website.
> Full flow: **Landing → Signup → Login → Dashboard → Connect IG → Automations → Pricing → Checkout → Success → Plan Active**.
> Every page consistent, mobile-clean, no broken states, no dev artifacts.
> **65 tasks** split across 3 owners.
> **Cascade executes Venkat's engineering tasks silently.**

---

## 📊 Distribution summary

| Owner | Tasks | Focus | Est. effort |
|-------|-------|-------|-------------|
| 👤 **Venkat** | 28 | Features, bug fixes, integrations, coordination, QA, Razorpay LIVE (reassigned 09-10) | ~10-12 hrs (Cascade will do most) |
| 👨‍🎨 **Ankit** | 22 | UI polish, new pages, responsive, accessibility | ~10-12 hrs |
| 👩‍💻 **Priyanka** | 15 | Meta review, domain, infra, DB | ~4-6 hrs + external waits |

---

# 👤 VENKAT — Features, Integrations, QA, Coordination

*(Cascade executes engineering ones silently. Coordination ones need your hands.)*

## Critical bug fixes (Cascade will do)

| # | Task | Files | Priority |
|---|------|-------|----------|
| V1 | **Fix webhook `subscription.activated`** — reads `notes.plan`, sets `plan` and `dm_limit` from `PLANS` config | `src/app/api/billing/webhook/route.ts` | 🔴 |
| V2 | **Fix webhook `subscription.cancelled`** — use `PLANS.free.dm_limit` instead of hardcoded 100 | `src/app/api/billing/webhook/route.ts` | 🔴 |
| V3 | **Add `callback_url` to Razorpay subscription** — user lands on `/billing/success?sub_id=X` post-payment | `src/app/api/billing/checkout/route.ts` | 🔴 |
| V4 | **Fix feedback widget** — only render when authenticated AND user has ≥1 DM sent | `src/components/FeedbackButton.tsx` | 🔴 |
| V5 | **Add `.vercel/` to `.gitignore`** | `.gitignore` | 🟡 |

## New engineering (Cascade will do)

| # | Task | Files | Priority |
|---|------|-------|----------|
| V6 | **Webhook idempotency** — dedupe by `event.id`, prevent double plan updates on Razorpay retries | Webhook route + new DB table | 🟡 |
| V7 | **Billing audit table** — log every checkout/webhook/verify event with request+response for support | New migration `billing_events` | 🟡 |
| V8 | **Rate limit `/api/billing/checkout`** — 10 req / 5 min per user | Checkout route | 🟡 |
| V9 | **Server-side session guard on `/dashboard`, `/admin`** — redirect at server (not client) if unauthenticated | Route pages | 🟡 |
| V10 | **Instagram OAuth callback: pretty error page** — currently JSON error on failure; render user-friendly page with retry | Callback route + new error page | 🟡 |

## Testing & QA (Cascade + Venkat manually)

| # | Task | Priority |
|---|------|----------|
| V11 | **E2E billing regression script** — automates: create checkout → simulate webhook with valid signature → assert DB updated | 🔴 |
| V12 | **Playwright smoke test** — signup → login → dashboard → connect IG (mock) → create automation | 🟡 |
| V13 | **Load test webhook endpoint** — 100 concurrent Razorpay webhooks, verify no data race | 🟢 |
| V14 | **Manual QA checklist** — walk through every page on desktop + mobile + iPad, log defects | 🔴 |
| V15 | **Verify all 12 GA4 events fire** — subscription_started, dm_sent, oauth_completed, etc. Use GA4 DebugView | 🟡 |

## Product & content (Cascade drafts, Venkat approves)

| # | Task | Priority |
|---|------|----------|
| V16 | **Rewrite landing hero copy** — punchier headline, benefit-driven subline, real testimonial quotes | 🟡 |
| V17 | **Rewrite pricing FAQ** — add 8 more Q&As covering refunds, cancellations, upgrade prorating, plan changes | 🟡 |
| V18 | **Write 3 SEO blog posts** — "How to auto-DM Instagram comments 2026", "10 Instagram automation ideas", "DM Shiyam vs WhoseDM vs ReplyKaro" | 🟢 |
| V19 | **Draft Product Hunt launch page** — tagline, gallery images, first comment | 🟢 |
| V20 | **Draft launch announcement** — LinkedIn + Twitter/X post (150-word + 280-char versions) | 🟡 |

## Razorpay LIVE setup (reassigned from Priyanka, 2026-09-10 — you own the Razorpay account)

| # | Task | Where | Priority |
|---|------|-------|----------|
| V23 | **Generate Razorpay LIVE API Keys** → share `KEY_ID` + `KEY_SECRET` with team via WhatsApp DM (never group) | Razorpay dashboard → Account & Settings → API Keys | 🔴 |
| V24 | **Create `DM Shiyam Business` plan** in Razorpay LIVE — ₹2,499 monthly. Share `plan_XXX` | Razorpay | 🔴 |
| V25 | **Create `DM Shiyam Agency` plan** in Razorpay LIVE — ₹5,999 monthly. Share `plan_XXX` | Razorpay | 🔴 |
| V26 | **Add LIVE webhook** — URL `https://dm-shiyam.vercel.app/api/billing/webhook`, all 5 subscription events, share secret | Razorpay | 🔴 |
| V27 | **Enable settlement account** — verify PAN, bank account, TDS — required for money to reach your bank | Razorpay | 🔴 |
| V28 | **Enable subscriptions product** — some Razorpay accounts need explicit activation | Razorpay | 🔴 |

## Coordination (Venkat does — 5-10 min total)

| # | Task | Who | Time |
|---|------|-----|------|
| V21 | **Add Test webhook in Razorpay** — Test Mode → Webhooks → Add. URL/secret/events I gave earlier | You | 3 min |
| V22 | **Ping Priyanka + Ankit** — share this doc, ready messages below | You + WhatsApp | 5 min |

---

# 👨‍🎨 ANKIT — UI Polish, New Pages, Responsive, A11y

## New pages (must-have for launch)

| # | Task | File | Priority |
|---|------|------|----------|
| A1 | **`/billing/success` page** — plan confirmed, confetti, "You're on Pro/Starter", "Go to Dashboard" CTA | New `src/app/billing/success/page.tsx` | 🔴 |
| A2 | **`/billing/failed` page** — clear error message, retry button, back to pricing | New `src/app/billing/failed/page.tsx` | 🔴 |
| A3 | **`/billing/cancelled` page** — when user closes Razorpay modal | New `src/app/billing/cancelled/page.tsx` | 🟡 |
| A4 | **404 page** — custom, on-brand, links back home | New `src/app/not-found.tsx` | 🟡 |
| A5 | **500/global error page** — friendly retry message + support email | New `src/app/error.tsx` + `global-error.tsx` | 🟡 |
| A6 | **FAQ / Help page** — searchable list of 30+ common questions | New `src/app/help/page.tsx` | 🟡 |
| A7 | **Refund policy page** — required for Razorpay live + Play Store parity | New `src/app/refund-policy/page.tsx` | 🔴 |
| A8 | **About Us page** — team, mission, contact | New `src/app/about/page.tsx` | 🟢 |

## Unified layout components

| # | Task | File | Priority |
|---|------|------|----------|
| A9 | **`<SiteNavbar />` component** — one navbar for all marketing pages, with `useSession()` auth state | New `src/components/SiteNavbar.tsx` | 🔴 |
| A10 | **`<SiteFooter />` component** — consistent footer across all pages | New `src/components/SiteFooter.tsx` | 🔴 |
| A11 | **Fix "Login/Sign Up" showing when logged in** — use `useSession()` on landing + pricing nav | `LandingContent.tsx`, `PricingContent.tsx` | 🔴 |

## Design polish

| # | Task | File | Priority |
|---|------|------|----------|
| A12 | **Login page polish** — Google button styled, "Remember me" checkbox, forgot-password link tuned, error state | `src/app/login/page.tsx` | 🟡 |
| A13 | **Register page polish** — password strength meter, inline validation errors, T&C checkbox required | `src/app/register/page.tsx` | 🟡 |
| A14 | **Dashboard plan badge + usage bar** — sticky header shows "Pro · 247/5,000 DMs · 12 days left" | `src/app/dashboard/page.tsx` | 🟡 |
| A15 | **Landing hero polish** — real IG mockup, 3 trust logos, testimonial rotator | `src/components/LandingContent.tsx` | 🟡 |
| A16 | **Testimonials section** — 3-6 quotes with photos, star rating | `src/components/LandingContent.tsx` | 🟢 |
| A17 | **Empty state UI** — every dashboard tab shows illustration + CTA when no data | `AccountsTab`, `AutomationsTab`, `AnalyticsTab` | 🟡 |
| A18 | **Toast notifications (sonner)** — success/error toasts everywhere; replace `alert()` calls | Add `sonner`, wrap in Providers | 🟡 |
| A19 | **Loading skeletons** — content-shaped skeleton on all data-fetching tabs | Multiple | 🟢 |

## Responsive & Accessibility

| # | Task | Priority |
|---|------|----------|
| A20 | **Mobile audit — every page < 768px** — fix hero overflow, pricing tile stack, dashboard tabs scroll | 🔴 |
| A21 | **Cookie banner UX** — fix z-index/position so it doesn't cover pricing cards on mobile | 🟡 |
| A22 | **Accessibility pass** — semantic HTML, ARIA labels, keyboard nav, focus rings, color contrast (WCAG AA) | 🟡 |

---

# 👩‍💻 PRIYANKA — Meta Review, Domain, Infra

> **⚠️ Reassigned 2026-09-10:** PR1-PR6 (Razorpay LIVE setup) moved to **Venkat's** section — he owns the Razorpay account/integration (built the original checkout/webhook code, Sprint 1 #1). Priyanka confirmed this is not her task.

## ~~Razorpay LIVE setup~~ — see Venkat's section (reassigned)

| # | Task | Where | Priority | Owner |
|---|------|-------|----------|-------|
| PR1 | Generate Razorpay LIVE API Keys → share `KEY_ID` + `KEY_SECRET` with team via WhatsApp DM (never group) | Razorpay dashboard → Account & Settings → API Keys | 🔴 | **→ Venkat** |
| PR2 | Create `DM Shiyam Business` plan in Razorpay LIVE — ₹2,499 monthly. Share `plan_XXX` | Razorpay | 🔴 | **→ Venkat** |
| PR3 | Create `DM Shiyam Agency` plan in Razorpay LIVE — ₹5,999 monthly. Share `plan_XXX` | Razorpay | 🔴 | **→ Venkat** |
| PR4 | Add LIVE webhook — URL `https://dm-shiyam.vercel.app/api/billing/webhook`, all 5 subscription events, share secret | Razorpay | 🔴 | **→ Venkat** |
| PR5 | Enable settlement account — verify PAN, bank account, TDS — required for money to reach your bank | Razorpay | 🔴 | **→ Venkat** |
| PR6 | Enable subscriptions product — some Razorpay accounts need explicit activation | Razorpay | 🔴 | **→ Venkat** |

## Meta App Review

| # | Task | Priority |
|---|------|----------|
| PR7 | **Record 30-60 sec screencast** — dashboard → comment on IG post → DM received (following `docs/META_APP_REVIEW.md`) | 🔴 |
| PR8 | **Fill Data Handling questionnaire** — answers drafted in `docs/META_APP_REVIEW.md` §PR8, sourced from `src/app/privacy/page.tsx` | 🔴 Drafted — paste into Meta form |
| PR9 | **Submit `instagram_manage_messages` for Advanced Access** | 🔴 |
| PR10 | **Submit `instagram_business_manage_messages` for Advanced Access** | 🔴 |
| PR11 | **Provide test Instagram account info to Meta reviewers** — drafted in `docs/META_APP_REVIEW.md` §PR11 (public username + demo keyword, no credentials shared) | 🔴 Drafted — paste into Meta form |

## Domain & DNS

| # | Task | Priority |
|---|------|----------|
| PR12 | **Buy `dmshiyam.com`** — GoDaddy/Namecheap, 1-yr registration | 🟡 |
| PR13 | **Point DNS to Vercel** — add A/CNAME records, wait for propagation | 🟡 |
| PR14 | **Follow `docs/V9_DOMAIN_CUTOVER_RUNBOOK.md`** — update Meta app, Google OAuth, Razorpay webhook, env vars | 🟡 |
| PR15 | **Get free SSL via Vercel** — auto-provisioned; verify HTTPS + HSTS | 🟡 |
| PR16 | **Set up email on domain** — `hello@dmshiyam.com`, `support@dmshiyam.com` (Zoho free / Google Workspace) | 🟢 |

## Infra & reliability

| # | Task | Priority |
|---|------|----------|
| PR17 | **Set up UptimeRobot / BetterStack** — monitor `/api/health` every 5 min, alerts to WhatsApp | 🟡 |
| PR18 | **Configure Sentry alert rules** — >5 webhook signature failures / 10 min, >10 payment.failed / hr — exact 7 rule configs drafted in `docs/SENTRY_SETUP.md` §5, ready to paste into Sentry UI (5 min) | 🟡 Configs ready — needs Priyanka to paste into Sentry dashboard |
| PR19 | **Verify daily token refresh cron runs** — ⚠️ task doc said 03:00 UTC but `vercel.json` schedules `refresh-tokens` at **06:00 UTC** daily (03:00 UTC is actually `reconcile-payments`). Verification steps below. | 🟡 Code verified correct — needs Priyanka to confirm via dashboard/Neon |
| PR20 | **Enable Neon Postgres backups** — verification + restore drill steps below | 🟢 Steps ready — needs Priyanka to check dashboard + run drill |
| PR21 | **Rotate NextAuth secret quarterly reminder** — ✅ reminder logged below; add to your own calendar too (GCal/Outlook) since this doc alone won't page you | 🟢 Logged |

### PR19 verification steps (2 min)

Code logic reviewed (`src/app/api/cron/refresh-tokens/route.ts`) — correct: pulls accounts expiring within 7 days, refreshes via `refreshLongLivedToken`, updates `access_token`/`token_expires_at`, sends throttled warning email on failure, reports to Sentry via `captureAlert`. **Actual schedule per `vercel.json`: `0 6 * * *` = 06:00 UTC daily** (not 03:00 — that slot belongs to `reconcile-payments`).

To confirm it's actually firing in prod:
1. **Vercel dashboard** → dm-shiyam project → **Cron Jobs** tab → `refresh-tokens` row → check "Last Run" timestamp is within the last 24h and status is 200.
2. **Or** in Neon SQL Editor, run:
   ```sql
   SELECT instagram_username, token_expires_at, updated_at
   FROM accounts
   WHERE is_active = true
   ORDER BY updated_at DESC;
   ```
   If `updated_at` for `dm_shiyam` moved forward at ~06:00 UTC and `token_expires_at` is now further out than before, the cron ran and refreshed successfully.

### PR20 — Neon Postgres backup verification + restore drill

**Good news:** Neon provides automatic **Point-in-Time Recovery (PITR)** on every plan — there's no "enable backups" toggle needed, it's on by default. What you actually need to do is *verify your retention window* and *prove a restore works*.

**1. Check your retention window (2 min)**
- Neon Console → your project → **Settings** → **Backup & restore** (or **Storage** tab, label varies by console version)
- Note the retention period shown (Free tier is typically 24h; Launch/Scale plans extend to 7-30 days)
- If it's too short for your comfort (e.g., only 24h and you want a week), that requires a plan upgrade — flag to Venkat if cost is a concern

**2. Run a restore drill (5 min) — proves backups actually work**
- Neon Console → **Branches** → **Create branch**
- Parent: your production branch → **Restore to a point in time** → pick a timestamp from ~1 hour ago
- Name it `restore-drill-test`
- Once created, grab its connection string and run a quick query against it (e.g., `SELECT count(*) FROM users;`) to confirm data matches what you'd expect from an hour ago
- **Delete the drill branch** after confirming (Neon charges for branch compute/storage if left running)

**3. Log the result below once done:**
| Drill date | Retention window confirmed | Restore successful? |
|---|---|---|
| _(pending)_ | _(pending)_ | _(pending)_ |

### PR21 — NEXTAUTH_SECRET rotation schedule (logged Sep 10, 2026)

| Rotation | Due date | Status |
|---|---|---|
| Next rotation | **Dec 2026** | ⬜ Pending |
| Following | Mar 2027 | ⬜ Pending |
| Following | Jun 2027 | ⬜ Pending |
| Following | Sep 2027 | ⬜ Pending |

**Rotation steps (when due):**
1. Generate new secret: `openssl rand -base64 32`
2. Update `NEXTAUTH_SECRET` in Vercel env vars (Production + Preview)
3. Redeploy — rotating this secret invalidates all existing NextAuth sessions, users must log in again (expected, not a bug)
4. Update local `.env.local` too, so dev matches prod behavior

> ⚠️ This table is a static reminder, not an active alert — it won't page anyone. **Priyanka: add a recurring calendar event** (Google Calendar/Outlook, quarterly, first occurrence Dec 1 2026) titled "Rotate NEXTAUTH_SECRET — dm-shiyam" linking back to this section.

---

# 📱 Ready-to-send messages

## To Priyanka

> Hey Priyanka, need these for Razorpay LIVE launch and Meta review:
>
> **Razorpay LIVE (highest priority):**
> 1. Generate LIVE API Keys (Razorpay → Account & Settings → API Keys → Generate Live Key). Send me `KEY_ID` + `KEY_SECRET` via DM (not group).
> 2. Create **DM Shiyam Business** plan in Live: ₹2,499 monthly. Send plan ID.
> 3. Create **DM Shiyam Agency** plan in Live: ₹5,999 monthly. Send plan ID.
> 4. Add LIVE webhook: URL `https://dm-shiyam.vercel.app/api/billing/webhook`, all 5 subscription events, pick strong secret and share.
> 5. Verify settlement account is enabled (PAN + bank verified) so money reaches us.
>
> **Meta App Review:**
> 6. Record 30-sec screencast per `docs/META_APP_REVIEW.md`, submit `instagram_manage_messages` + `instagram_business_manage_messages` for Advanced Access.
>
> **Domain:**
> 7. Buy `dmshiyam.com` when you can, follow `docs/V9_DOMAIN_CUTOVER_RUNBOOK.md`.
>
> Full task list: `docs/SPRINT_4_LAUNCH_TASKS.md`. Your section = PR1-PR21.

## To Ankit

> Hey Ankit, launch polish tasks. Full list in `docs/SPRINT_4_LAUNCH_TASKS.md` (your section A1-A22).
>
> **Blockers (do first):**
> - A1, A2, A3 — post-payment pages (`/billing/success`, `/billing/failed`, `/billing/cancelled`)
> - A7 — refund policy page (Razorpay Live blocker)
> - A9, A10, A11 — unified navbar/footer + fix "Login/Sign Up" showing when logged-in
> - A20 — mobile audit
>
> **Polish (parallel):**
> - A12-A19 — login/register polish, dashboard plan badge, toasts, skeletons, empty states
>
> Design tokens: use existing Tailwind indigo primary. Keep it consistent with current pricing page style.

---

## 🚀 Cascade's execution order (Venkat's tasks)

**Phase 1 — Fix broken (~1 hr, right now):**
V1 · V2 · V3 · V4 · V5

**Phase 2 — Reliability (~1 hr):**
V6 · V7 · V8 · V9 · V10

**Phase 3 — Testing (~1 hr):**
V11 · V12 · V14 · V15

**Phase 4 — Content (~1 hr):**
V16 · V17 · V18 · V19 · V20

**Between phases:** commit + push + verify Vercel deploy.

---

## 📈 Definition of "launched"

- ✅ Every page loads on mobile + desktop, no visual bugs
- ✅ Signup → Login → Dashboard → Connect IG → Automation → DM sent — full flow works
- ✅ Landing → Pricing → Checkout → Payment → Success — full flow works, DB plan updated
- ✅ Razorpay LIVE keys working, at least 1 real ₹149 test payment completed
- ✅ Meta App Review submitted (approval can happen post-launch)
- ✅ Custom domain live at `dmshiyam.com`
- ✅ Sentry, GA4, uptime monitoring all firing
- ✅ Refund policy, T&C, Privacy pages published
- ✅ Public beta announcement drafted and ready to post
