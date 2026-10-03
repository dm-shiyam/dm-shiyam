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

