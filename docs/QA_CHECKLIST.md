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

| # | Browser | Device | Flow | Bug | Severity | Fixed in |
|---|---------|--------|------|-----|----------|----------|
|   |         |        |      |     |          |          |

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
