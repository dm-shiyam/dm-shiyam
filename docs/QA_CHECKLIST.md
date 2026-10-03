# Cross-Browser + Device QA Checklist (A8)

**Last full pass**: _tbd_
**Automated coverage**: `pnpm test:e2e` — 60 tests across chromium / firefox / webkit / mobile-chrome / mobile-safari. Covers *functional* smoke (renders, no console errors, forms present, auth redirects). Visual bugs still need a human eye.

---

## 1. Before you start

- [ ] Deploy the branch you want to test → get its Vercel URL.
- [ ] Run automated suite first: `pnpm test:e2e` — if any project fails, fix before manual pass.
- [ ] Grab a real iPhone (Safari) and Android phone if available. Emulators are fine for layout, not OAuth cookies.

---

## 2. Browsers × devices matrix

Test each critical flow (§4) on **at minimum** one column per row. Skip cells you don't ship to.

|              | Chrome | Firefox | Safari (macOS) | Chrome mobile | Safari mobile (iPhone) |
|--------------|:------:|:-------:|:--------------:|:-------------:|:----------------------:|
| Landing      |        |         |                |               |                        |
| Signup (creds) |      |         |                |               |                        |
| Signup (Google) |     |         |                |               |                        |
| Login (creds) |       |         |                |               |                        |
| Login (Google) |      |         |                |               |                        |
| Forgot / reset password |         |                |               |                        |
| Dashboard    |        |         |                |               |                        |
| Connect IG (OAuth) |  |         |                |               |                        |
| Create automation |   |         |                |               |                        |
| Pricing → Razorpay |  |         |                |               |                        |
| Sign out     |        |         |                |               |                        |
| Dark mode toggle |    |         |                |               |                        |

Mark ✅ / ❌ / ➖ (N/A). Note any bug + browser under §5.

---

## 3. Known cross-browser risk areas in this codebase

Watch these specifically — they've historically broken per-engine:

- **`backdrop-filter: blur(...)` on the OnboardingWizard modal + dashboard header.** Firefox pre-103 needed a flag; some Android WebViews still ignore it. If the modal background looks solid instead of blurred, note it.
- **Custom `scrollbar-hide` on the dashboard tabs strip.** Safari + Firefox implement it differently — a visible scrollbar shouldn't appear on the tabs row.
- **`-webkit-overflow-scrolling: touch` on the same strip.** Test flick-scroll on real iOS — should feel native, not stutter.
- **Server-sent events for activity stream** (`/api/activity/stream`). Some corporate proxies + iOS on cellular drop long-lived connections. Verify the 30-second polling fallback still updates the Activity tab when SSE dies.
- **Sonner toasts** (first-DM feedback, welcome, etc). iOS Safari sometimes clips them inside `overflow: hidden` parents. Verify the toast is fully visible and not chopped.
- **Google OAuth on iOS Safari.** ITP (Intelligent Tracking Prevention) can nuke session cookies mid-OAuth. If the redirect back from Google logs you out or loops, that's the classic symptom — check `NEXTAUTH_URL` and cookie SameSite settings.
- **Gradients + `bg-clip-text`.** Landing hero uses `bg-gradient-to-r ... bg-clip-text text-transparent` — Safari sometimes renders as solid color.
- **`useSearchParams()` inside `<Suspense>`.** LoginFormComponent and ResetPasswordComponent both use it. If WebKit shows blank page while Chrome renders fine, Suspense boundary is misplaced.
- **`dark:` classes via `prefers-color-scheme`.** Firefox private mode + some Android skins report wrong values. Manually toggle system theme + verify.

---

## 4. Critical flows (do these on every browser × device you're testing)

### 4a. Public landing → signup → dashboard

1. Fresh incognito window → visit `/`.
2. Landing loads: hero, features, pricing card, footer all visible.
3. No console errors (open DevTools Console before navigating).
4. Click "Sign Up" / "Get Started" → land on `/register`.
5. Enter throwaway email + password → submit → land on `/dashboard` with:
   - Getting Started checklist card (0/3)
   - Stats grid (all zeros)
   - Tabs strip scrolls horizontally without visible scrollbar
6. Click LogOut icon (top-right) → land on `/` with session cleared.

### 4b. Google login (any Gmail, not just test users)

1. Fresh incognito → `/login`.
2. Click **Continue with Google**.
3. Sign in with a Gmail that is **NOT** on your Google Auth Platform → Audience → Test users list.
4. Google consent screen shows correct app name (DM Shiyam) + only asks for `email`, `profile`, `openid`.
5. Click Continue → land on `/dashboard`.
6. Sign out → try again with the same Gmail → should log straight in (no dupe user row in DB).

### 4c. Forgot / reset password

1. Fresh incognito → `/login` → click "Forgot password?".
2. Enter your email → submit → success toast.
3. Check inbox (⚠️ while `FROM_EMAIL=onboarding@resend.dev`, only the Resend account owner receives).
4. Click the reset link → land on `/reset-password?token=...`.
5. Type a new password (`TestPass2026`) in both fields. **Click the eye icon on both** to verify what's typed matches.
6. Submit → "Password updated!" screen → auto-redirect to `/login`.
7. Log in with the new password → land on dashboard.
8. Sign out → try old password → get "Invalid email or password" (not "CredentialsSignin").

### 4d. Instagram OAuth (real Business/Creator account required)

1. Signed in → Accounts tab → **Connect Instagram**.
2. Redirected to Meta OAuth screen. Grant all permissions.
3. Redirected back with `?ig_connected=1` toast.
4. Account appears in the Accounts list with correct @username + Active badge.
5. Getting Started checklist item 1 flips to ✓.

### 4e. Create automation

1. Automations tab → **New Automation**.
2. Pick a template (Lead Magnet).
3. Verify tooltips appear on hover for: Instagram Account select, Trigger Keywords, DM Message.
4. Select the IG account you just connected.
5. Save → row appears in the list. Checklist item 2 → ✓.

### 4f. End-to-end DM (needs a second IG account to comment)

1. From a **different** IG account, comment your trigger keyword on one of your posts.
2. Within ~10s:
   - Activity tab shows the row with green ✓ (DM sent).
   - Recipient IG account actually received the DM.
   - First-DM feedback toast appears (👍 / 👎).
   - Checklist item 3 → ✓, whole card auto-hides.

### 4g. Razorpay ₹1 test (billing risk!)

1. `/pricing` → click a paid tier's Subscribe button.
2. Razorpay modal opens with correct plan + amount.
3. Complete with test card `4111 1111 1111 1111` if in test mode, or real card if live (₹1 tier if you have one).
4. Redirected back to app with success.
5. Verify DB: `users.plan` = the plan you bought, `razorpay_subscription_id` populated.
6. Dashboard header shows the Crown badge with correct plan.
7. Cancel subscription in Razorpay dashboard → verify status flips to `cancelled` within a few minutes (via webhook or reconciliation cron).

### 4h. Dark mode

1. Change your OS to dark → app should follow (check `bg-gray-950`, `dark:text-white` etc all render).
2. Toggle via the theme button in the header → immediate switch, no flash.
3. Modal (OnboardingWizard) still readable in both modes.

---

## 5. Bug log

### Pass on 2026-09-09 — desktop Chrome/Safari/Firefox + iPhone Safari + iPhone Chrome

| # | Browser | Device | Flow | Bug | Severity | Fixed in |
|---|---------|--------|------|-----|----------|----------|
| 1 | All | Mobile | Dashboard tabs | Tab labels chopped to first 4 chars ("Auto", "Acti"…). Ugly + unclear. | Medium | `44f964a` — full labels + horizontal scroll + 44px tap targets |
| 2 | All | All | IG OAuth return | OAuth callback redirects to `/dashboard` but dashboard defaults to Automations tab; success/error toast lives in AccountsTab so it silently disappeared. | High | `44f964a` — auto-switch to Accounts tab on `ig_connected` / `ig_error` query param |
| 3 | Chrome / Firefox | iPhone (iOS) | IG OAuth | iOS routes Instagram OAuth to native Instagram app via Universal Links; app-side flow reliably fails with "Something went wrong". Native Safari doesn't trigger the handoff. | High | `a0d61b5` — detect `CriOS/FxiOS/EdgiOS` UA + show amber warning banner above Connect Instagram: "On iPhone? Open this page in Safari." |
| 4 | All | All | `/pricing` | Navbar showed Login/Sign Up even for logged-in users — looked like session expired. | Medium | `c95fbe8` — session-aware navbar with Dashboard link + email |
| 5 | All | All | `/pricing` cards | Prices hard-coded and wrong (₹99 Pro, ₹999 Business). Free showed "$0" (wrong currency). Feature list said "5 automations" but PLANS says 2. | High | `c95fbe8` — render from `PLANS` constant so display can't drift |
| 6 | All | All | Discovery | Free-tier users had no discoverable way to reach `/pricing` from the app. Landing navbar had no Pricing link either. | Medium | `c95fbe8` — Upgrade pill in dashboard header (when free plan) + Pricing link on landing navbar |
| 7 | All | All | Auth error copy | Login form showed raw NextAuth string "CredentialsSignin" instead of user-readable "Invalid email or password". | Low | `efd1f90` (earlier session) |
| 8 | All | All | `/login` | Google sign-in button entirely missing (was on old LoginForm.tsx but LoginFormComponent used by /login route lacked it). | High | `8d9eb6f` (earlier session) |

Regression tests added in `tests/e2e/smoke.spec.ts` for items 4, 7, 8. Items 1-3 + 5-6 verified manually on the platforms listed.

---

## 6. Accessibility follow-ups (surfaced during A8)

Not blockers for A8, but noted for future work:

- [ ] **Wire `<label htmlFor>` + `<input id>` on auth forms.** Currently `getByLabel(/email/i)` fails in Playwright because the pair isn't associated — same reason screen readers can't announce the label. Fix in `LoginFormComponent.tsx`, `RegisterFormComponent.tsx`, `ResetPasswordComponent.tsx`, `ForgotPasswordComponent.tsx` (if that exists).
- [ ] **Add `aria-label` on the reveal-eye buttons.** Done for reset-password; missing on login.
- [ ] **Skip-link + landmark roles** — landing page has no `<main>` / skip-nav for keyboard users.
- [ ] **Focus rings on the Sonner toast dismiss button** are default browser blue — inconsistent with the rest of the app's purple focus ring.

---

## 7. When to re-run this checklist

- Any change to auth (`src/lib/auth.ts`, `LoginFormComponent`, `ResetPasswordComponent`).
- Any change to the dashboard shell (tabs, header, sidebar).
- Any Tailwind config change (`tailwind.config.ts`).
- Before a marketing push / paid campaign starts.
- On every major browser release (mostly relevant for Safari — Chrome/Firefox rarely break existing sites).

---

## 8. S5.3.1 — Auth flow end-to-end (manual pass, destructive)

> Automated coverage: `pnpm test:e2e` now also runs `billing-and-legal.spec.ts` + `session-persistence.spec.ts`. Those are safe against prod. The checks below cannot be automated without burning Resend quota, creating real users in prod, or holding real Google credentials — do them by hand once per release-blocking change.
>
> **Target URL**: `https://dm-shiyam.vercel.app` (swap to `https://dmshiyam.com` once S5.7 cutover completes).
> **Account recipe**: use a brand-new Gmail alias like `your+ankit-s531-<yyyymmdd>@gmail.com` so every pass is a clean slate. Delete via `scripts/delete-user.mjs` or `/admin → Users → Delete` when done.

### 8.1 Signup (credentials) → verify → first login

- [ ] Open `/register` in a private window.
- [ ] Fill email + name + password that meets policy (≥ 8 chars, letters+digits). Submit.
- [ ] You land on `/dashboard` **but immediately get redirected to `/verify-email-pending`** (dashboard gate). Confirm the pending page shows your email + a Resend button.
- [ ] Welcome email arrives at that address within ~1 min (sender: `onboarding@resend.dev` / `FROM_EMAIL`). _(Note: Resend sandbox mode only delivers to the Resend account owner's inbox until `dmshiyam.com` DNS is verified — if you don't see it, that's expected on a non-owner address.)_
- [ ] Click **Resend verification** on the pending page. Confirm `POST /api/auth/resend-verification` returns 200 (Network tab).
- [ ] Open the verification email → click the magic link → it lands you on `/dashboard?verified=1`. Dashboard now loads normally (no more pending gate).
- [ ] Log out → log back in with the same credentials → straight to `/dashboard`, no pending gate.
- [ ] **Password rejection:** repeat §8.1 with a password that fails policy (6 chars). Expect 400 with the specific policy error, not a 500.
- [ ] **Duplicate email:** try signing up with the same email again. Expect 409 "Email already registered", friendly form error.

### 8.2 Signup (Google) → first login

- [ ] Open `/register` in a private window. Click **Sign up with Google**.
- [ ] Pick a Google account that has NEVER touched DM Shiyam.
- [ ] You consent on `accounts.google.com` → bounce back → land on `/dashboard` with **no verify-email gate** (Google OAuth marks `email_verified: true` server-side per `src/lib/auth.ts` line 120).
- [ ] On `/admin → Users`, confirm the new user has `provider = google` and `email_verified_at` populated.
- [ ] Log out → `/login` → click **Continue with Google** → same account → straight to `/dashboard` (session restored, no second consent).
- [ ] **Collision guard:** if a credentials account already exists at that email, Google sign-in should surface a friendly error (OAuthAccountNotLinked), not a 500. Already covered in copy by commit `efd1f90`; eyeball the toast.

### 8.3 Forgot / reset password

- [ ] Logged out, `/login` → click **Forgot password?** → `/forgot-password`.
- [ ] Submit your test email → UI shows generic "If an account exists we sent a link" (anti-enumeration — do NOT leak existence).
- [ ] Reset email lands within ~1 min with a tokenized `/reset-password?token=…` link.
- [ ] Click the link → `/reset-password` loads the form.
- [ ] Both password fields have reveal-eye toggles. Both match on live typing (hint "Passwords don't match yet" disappears once equal).
- [ ] Submit new password → success toast → auto-redirect to `/login`.
- [ ] Log in with the NEW password → success. Log in with the OLD password → "Invalid email or password" (not a 500).
- [ ] Click the same reset link a second time → "Invalid or expired link" (one-time use enforced by `updatePassword` rowCount check).
- [ ] **Rate limit:** fire 6 forgot-password requests in 15 min → the 6th returns 429 with a Retry-After.

### 8.4 Session persistence across tabs + reloads

- [ ] Log in. Open 3 more tabs on `/dashboard`, `/pricing`, and `/admin` (if admin role). All 3 render without redirecting to `/login`.
- [ ] Hard-refresh each tab (⌘⇧R / Ctrl-Shift-R). Still authed.
- [ ] Close the browser entirely, reopen, navigate back to `/dashboard`. If "Keep me logged in" / long-session is the design, you stay authed; otherwise expect redirect to `/login`. Document which it is here: _______________.
- [ ] In tab A, log out. Click any protected link in tab B — expect redirect to `/login` (NextAuth cookie removal visible across tabs). May require 1 interaction to trigger (Next-Auth doesn't push a logout broadcast; a navigation does the check).
- [ ] **Cookie flags on prod:** devtools → Application → Cookies → `__Secure-next-auth.session-token` has `Secure`, `HttpOnly`, `SameSite=Lax`. If any flag is missing on the production domain, flag it under S5.2.9.

### 8.5 Fallback cases

- [ ] Visit `/dashboard` while signed in as a brand-new user — the first-time Onboarding wizard opens (A10 Getting Started checklist appears).
- [ ] Visit `/admin` as a non-admin user — expect redirect to `/dashboard` (not a 500).
- [ ] Hit `/api/admin/funnel` directly (curl) with no cookie — expect 401. With a non-admin cookie — expect 403.

### 8.6 Known gaps / things NOT in scope here

- Google OAuth consent screen screenshots → part of S5.7.7 (needs the final `dmshiyam.com` domain in Google Cloud Console).
- Full UX on the custom domain → blocked on S5.7 (Venkat).
- Password-less / magic-link login → not shipped yet, not in S5.3.1 scope.

### 8.7 Record the pass

Append a one-liner to §5 bug log for each defect found. When clean, set the "Last full pass" date in the header of this doc and tick S5.3.1 as ✅ in `TASK_LIST.md`.

---

## 9. S5.3.2 — Onboarding flow end-to-end (manual pass, destructive)

> Automated coverage: `tests/e2e/onboarding.spec.ts` guards the entry points that are safe without auth (OAuth-authorize unauth bounce + callbackUrl preservation, pretty error page, protected-route redirects, no-Facebook-Page copy on pricing FAQ). The rest below needs a real Instagram Business/Creator account you own and a second account to post trigger comments from.
>
> **Target URL**: `https://dm-shiyam.vercel.app` (swap to `https://dmshiyam.com` after S5.7 cutover).
> **Setup**: pre-create a brand-new credentials account per §8.1 so you start at the empty dashboard with a verified email. Delete via `/admin → Users → Delete` when done.

### 9.1 First-login onboarding wizard

- [ ] Fresh user with 0 automations lands on `/dashboard` → the wizard modal auto-opens (step 1 of 3) after the initial fetch resolves.
- [ ] Step 1 "Welcome to DM Shiyam" — click **Get started** → advances to step 2.
- [ ] Step 2 "Connect your Instagram account" — click **I'll do this later** → advances to step 3 without connecting.
- [ ] Step 3 "Create your first automation" has a green "last step" badge visible.
- [ ] Click the X in the corner → wizard closes; `onboardingDismissed` stays `true` for the rest of the session (don't reopen on next tab change inside the same page). Hard-reload the page → wizard reappears (dismissal is in-memory only — this is intentional nagging until you have ≥1 automation).
- [ ] From a user who ALREADY has 1 connected account but 0 automations: wizard opens at step 2 (not 1) per `initialStep={accounts.length > 0 ? 2 : 0}`.

### 9.2 Connect Instagram (IBL happy path)

- [ ] From the wizard step 2 OR the Accounts tab "Connect Instagram" button → browser navigates to `https://www.instagram.com/oauth/authorize` with the three `instagram_business_*` scopes in the URL. Confirm `force_authentication=1` is in the query (so reviewers always see the consent screen).
- [ ] Instagram's consent screen lists the three permissions. Approve.
- [ ] Browser bounces back to `/api/instagram/oauth/callback?code=...&state=...` → the server exchanges short-lived → long-lived → fetches `/me` → persists the account → subscribes webhooks → redirects to `/dashboard?ig_connected=1&username=<handle>`.
- [ ] Dashboard **auto-switches to the Accounts tab** (regression guard from `44f964a`) and shows a success toast with the connected handle.
- [ ] Accounts tab now lists the connected IG as an active card with a green "Active" badge and `token_expires_at` ~ 60 days out.
- [ ] `/api/billing/status` or `/admin → Users` shows this user's `first_account_connected_at` populated with the current timestamp.
- [ ] **Negative:** reject the consent screen → bounce back to `/dashboard?ig_error=access_denied` with a visible amber warning banner; account NOT persisted.
- [ ] **Negative:** try to connect a Personal (not Business/Creator) IG → Instagram's own consent screen or Meta Graph `/me` responds with an error → user sees the amber "Switch to Professional" callout on the Accounts tab (we don't swallow it to a generic 500).
- [ ] **Hijack guard:** sign in as user B, try to connect the SAME IG account already bound to user A → redirect to `/dashboard?ig_error=already_connected`; A's binding stays intact.

### 9.3 Create first automation (from a template)

- [ ] After connecting IG, you land on Accounts tab. Switch to Automations tab → click **New Automation**.
- [ ] Pick a template ("Lead Magnet", "Discount Code", or "Link in Bio") — all three fields pre-fill cleanly.
- [ ] Select the Instagram account you just connected (should be the default when there's only one).
- [ ] Keyword field accepts lowercase single word (e.g. `info`). Case-insensitive matching is enforced server-side.
- [ ] DM message supports the `{{username}}` placeholder — type it, Save, re-open to confirm it round-tripped.
- [ ] Save → automation appears in the list with "Active" toggle on. Database field `user_id` on the row matches your signed-in user id (quick `SELECT user_id FROM automations WHERE id = …` in Neon to confirm tenant isolation).
- [ ] Negatives: duplicate keyword for the same account rejects. Empty DM template rejects. Keyword with special chars (`$`, `@`) rejects. All with friendly error text, not a 500.

### 9.4 First DM (self-comment test)

- [ ] Sign into a SECOND Instagram account (your personal one) on a different device/browser profile.
- [ ] Post a public comment with your trigger keyword on one of the connected IG account's recent posts (last 7 days — Instagram webhook delivery is best-effort on older media).
- [ ] Within ~5 s, DM Shiyam should:
  - [ ] Reply publicly to your comment (if comment-reply is enabled on the automation).
  - [ ] Send a DM to your second account with the `{{username}}` placeholder substituted.
- [ ] Activity tab shows a row with: your IG handle (commenter), the trigger keyword, "DM sent" status, timestamp.
- [ ] `/admin → Users` → your test user now shows `first_dm_sent_at` populated.
- [ ] Getting Started checklist above the stats grid auto-hides (allDone condition triggered).
- [ ] GA4 Realtime should show a `first_dm_sent` event with the user id as the custom param.
- [ ] **Dedup:** post the SAME comment text again on the SAME post → activity log a second DM? NO — our `claimDmSend` enforces one DM per `(automation_id, comment_id)` triple. If you see duplicate, that's a critical regression against P12 work.
- [ ] **Multi-user independence:** have your second account comment the keyword on a different post or at a different time — gets its own DM (dedup is per-comment, not per-sender).

### 9.5 Error-state onboarding

- [ ] Connect IG → wait → go to IG Settings and revoke DM Shiyam's permission (simulates Meta deauth). Our deauth callback (`/api/instagram/data-deletion`) should flip the account to inactive in our DB within a few seconds, and the Accounts tab card should show a red "Reconnect" badge instead of the green Active one.
- [ ] Expire the IG token (hard to simulate without waiting 60 days — the daily refresh-tokens cron should prevent this. Verify by querying `SELECT last_refreshed_at FROM accounts` and confirming it was touched within the last 24 h).
- [ ] Delete the connected IG from `/admin → Users` while a webhook fires for it → webhook route logs a warning but doesn't 500.

### 9.6 Known gaps / things NOT in scope here

- Full Playwright coverage of the wizard/checklist UI requires auth plumbing we don't have in CI. Covered by this manual pass instead.
- The daily token refresh cron is covered under P20.2 (Priyanka/Venkat), not this task.
- Multi-account automation routing is validated separately under S5.3.4.

### 9.7 Record the pass

Append a one-liner to §5 bug log for each defect found. When clean, update S5.3.2 in `TASK_LIST.md`.

---

## 10. S5.3.3 — Billing flow end-to-end (manual pass, destructive, live money)

> Automated coverage: `tests/e2e/billing.spec.ts` (10 specs — auth guards on checkout / cancel / status / webhook, 405 on GET-webhook, bogus-signature fail-closed, pricing-page live INR labels for monthly + yearly from `PLANS`, no-auth Subscribe routes to /register with callbackUrl carrying `?plan=…`, `/billing/success` + `/billing/cancel` landing-page smoke). All 10 green on prod.
>
> **Target URL**: `https://dm-shiyam.vercel.app` (swap to `https://dmshiyam.com` after S5.7 cutover).
> **Prerequisites**: Razorpay live keys in Vercel env (already confirmed — Venkat 2026-10-03), live mode plans created and plan ids wired into `RAZORPAY_PLAN_*` env vars, `/api/health` reports `razorpay: ok`. Needs a UPI id or card you can actually charge; refund after.

### 10.1 Free → Pro checkout (happy path, live money)

- [ ] Signed-in on a fresh user still on the `free` plan. Confirm `/admin → Users` shows `plan=free, subscription_status=none, dm_limit=500`.
- [ ] Open `/pricing`, click the **Pro** monthly Subscribe → Razorpay Checkout modal opens.
- [ ] Modal shows `DM Shiyam Pro` and the price `₹799` (matches `PLANS.pro.price_monthly / 100`). **Fail the test** if it shows ₹99 (old regression QA §5 bug 5).
- [ ] Modal does NOT show a "TEST MODE" red banner (live keys loaded).
- [ ] Complete UPI payment with a real amount. The modal closes, `handler` fires → `POST /api/billing/verify` returns 2xx.
- [ ] Browser redirects to `/billing/success?subscription=sub_XXX&plan=pro&cycle=monthly`:
  - [ ] Shows real `sub_XXX` id (not a placeholder)
  - [ ] Shows Plan: `Pro (Monthly)` and Amount: `₹799`
  - [ ] Status row flips from "Checking…" / "Confirming…" to **Active** within ~15 s (poll gives up after that → "Payment received — confirming" copy fires)
- [ ] `/admin → Users` for this user now shows: `plan=pro, subscription_status=active, dm_limit=25000, razorpay_subscription_id=sub_XXX`.
- [ ] Dashboard DM-quota banner is gone / updates to `0 / 25,000`. Any upgrade pill in the header disappears.
- [ ] GA4 Realtime shows `subscription_started` with `plan=pro, cycle=monthly, amount=79900, currency=INR` within ~30 s (fired server-side from the webhook, not the client).
- [ ] Email receipt from Razorpay lands at your account email. Our own `sendSubscriptionActivated` email (branded with the logo) also lands.
- [ ] `billing_events` table has exactly one row for this `event_id` (idempotency check — hit `/api/billing/webhook` with the same event id and confirm `duplicate:true`).

### 10.2 Yearly checkout (plan + cycle + price all consistent)

- [ ] Repeat §10.1 with the Yearly toggle. Pro yearly must charge `₹7,990` (= 10 × monthly). GA4 event has `cycle=yearly, amount=799000`.
- [ ] Receipt page shows "Pro (Yearly)" and `₹7,990`.

### 10.3 Mid-cycle upgrade / tier jump

- [ ] From an active Starter user, click Subscribe on Pro.
- [ ] Razorpay flow completes → webhook fires `subscription.activated` with the new plan slug in `notes.plan`.
- [ ] `plan` flips `starter → pro`, `dm_limit` flips `5000 → 25000`, `subscription_status` stays `active`, `razorpay_subscription_id` is replaced with the new sub id. The OLD Starter sub is cancelled by Razorpay automatically (or we cancel it in the upgrade flow).
- [ ] `subscription_started` DOES NOT re-fire (webhook guards with `!wasActive` — only first activation counts). Confirm by watching GA4 Realtime.

### 10.4 Cancel at cycle end + grace period

- [ ] Signed in as an active Pro user → Dashboard → click the plan pill in the top-right header → **Cancel subscription**.
- [ ] Confirmation modal appears. Confirm.
- [ ] `POST /api/billing/cancel` returns `{status: "cancelled", message: "…cancels at the end of the current billing cycle…"}`.
- [ ] Dashboard pill now shows "Cancels on <date>" using the `current_end` returned by Razorpay.
- [ ] `/admin → Users` shows `subscription_status=cancelled` **but `plan=pro`** (grace period — paid access until period end).
- [ ] `sendSubscriptionCancellationScheduled` email lands (branded, logo header, shows `cycleEndUnix` formatted).
- [ ] Trying to Cancel again → 400 "already scheduled to cancel" with a friendly toast, not a 500.
- [ ] Rate limit: fire 6 POST `/api/billing/cancel` requests in 10 min from the same user → 6th returns 429 with Retry-After.
- [ ] **Negative:** signed in as a free user, hit `POST /api/billing/cancel` → 400 "You're on the free plan — nothing to cancel."

### 10.5 Automatic downgrade at cycle end

- [ ] Hard to simulate without waiting a month. **Shortcut:** in Razorpay dashboard, manually cancel the subscription (or fast-forward end date). Razorpay fires `subscription.cancelled` → our webhook:
  - [ ] `plan` → `free`, `dm_limit` → `500`, `subscription_status` → `cancelled` (NOT `expired`, that's reserved for `subscription.completed`).
  - [ ] `sendSubscriptionEnded` email lands with `previousPlan` captured correctly ("Previous plan: Pro").
- [ ] For a subscription that reaches its `total_count` without being cancelled, Razorpay fires `subscription.completed` instead → same downgrade but `subscription_status=expired`.
- [ ] Dashboard back to free-tier UX (quota banner reappears, upgrade pill reappears). Automations keep their rows but no new DMs fire (webhook claims a free-tier DM slot and respects the 500 cap).

### 10.6 Payment failures (reused from V12)

Re-run `node scripts/test-payment-failures.mjs` against prod DB and confirm 4/4 pass:

- [ ] 12.1 `payment.failed` → user stays `free`, Sentry `captureAlert` fired.
- [ ] 12.2 Checkout closed without webhook → DB untouched, no orphan `pending` row.
- [ ] 12.3 20-way concurrent `subscription.activated` storm → exactly one user ends active (idempotent via SET-based `updateUserPlan`).
- [ ] 12.4 Invalid webhook signature → 400, no state change.

### 10.7 Reconciliation cron (V11)

- [ ] Trigger `GET /api/cron/reconcile-payments` with the `CRON_SECRET` header.
- [ ] Response includes a 25-h window scan; no mismatches on a clean day.
- [ ] Create a deliberate mismatch (manually mark a user `active` without a matching Razorpay payment) → next cron run fires Sentry `captureAlert` with the clipped sample.
- [ ] Scheduled run (03:00 UTC daily) shows up in Vercel Cron logs.

### 10.8 Receipts, refunds, GST

- [ ] Razorpay auto-invoice email for the live payment includes GSTIN + line item.
- [ ] Issue a partial refund from the Razorpay dashboard → `refund.created` webhook fires → `sendRefundInitiated` email lands at the user's inbox with refund id + expected timeline. UPI landed in bank in ~2-3 business days.
- [ ] Our `/refund-policy` page §8 timelines match what we actually told the user.

### 10.9 Known gaps / things NOT in scope here

- Load-test of concurrent checkouts past Vercel function limits — not needed pre-launch at current volumes.
- Dunning / failed-renewal retry flow — Razorpay handles this upstream; our webhook only reacts to final `subscription.halted` which currently we do not special-case (TODO after launch if churn signals demand it).
- International cards / multi-currency — single-market (INR / India) only this quarter.

### 10.10 Record the pass

Append a one-liner to §5 bug log for each defect found. When clean, update S5.3.3 in `TASK_LIST.md`.

