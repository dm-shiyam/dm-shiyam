# Security Scan Report — 2026-10-03

Scope: S5.2.1 (`npm audit`), S5.2.6 (env var sweep), S5.2.7 (OWASP Top 10
static review) from `docs/TASK_LIST.md`. Owner: Venkat.

Scanner: static review by the engineering team using `npm audit --omit=dev`,
grep over the `src/` tree, and manual code reading of every API route.

## TL;DR

| Area | Verdict | Action required |
|---|---|---|
| S5.2.1 — Dependency CVEs | 🔴 11 critical + 5 high in prod deps | Run `npm audit fix` for the ~90% auto-fixable issues; schedule NextAuth v5 upgrade for the rest |
| S5.2.6 — Secrets in client bundle | ✅ Clean | — |
| S5.2.6 — `.env.example` drift | 🟡 7 undocumented required vars | Add to `.env.example` so new devs can onboard |
| S5.2.7 — Auth bypass / BAC | ✅ Clean | — |
| S5.2.7 — IDOR | ✅ Clean (defense-in-depth suggestion) | Optional: push `user_id` into SQL predicates in `lib/db.ts` ID-only helpers |
| S5.2.7 — XSS in DM preview | ✅ Clean | — |
| S5.2.7 — SSRF in IG fetch | ✅ Clean | — |

No immediately exploitable vulnerabilities were found in the application
code. The main risk is from unpatched upstream dependencies.

---

## S5.2.1 — `npm audit --production`

Totals: **130 vulnerabilities (113 low, 1 moderate, 5 high, 11 critical).**
113 of those are "Architecture-Quality — component older than 5 years" lints
with no CVE attached and are not actionable security findings; the real list
is below.

### Critical / high CVEs

| Package | Range | Severity | Example CVE | Auto-fix |
|---|---|---|---|---|
| `next` | ≤16.3.7 | critical | CVE-2026-75604 (sev≥9), CVE-2026-64641/42 (sev≥7) | `npm audit fix` → next@16.3.8+ |
| `next-auth` | ≤4.24.15 | critical | sonatype-2026-004997 (sev≥7) | ⚠️ needs NextAuth **v5** upgrade (breaking) |
| `postcss` | ≤8.5.11 | critical | CVE-2026-45623 (sev≥9) | `npm audit fix` (transitive via next) |
| `sharp` | <0.35.4 | critical | sonatype-2026-006830 | `npm audit fix` |
| `source-map-js` | <1.2.2 | critical | CVE-2026-93749 | `npm audit fix` |
| `axios` | * | critical | 12× sonatype-2026-008260..008290 | `npm audit fix` (razorpay dep) |
| `follow-redirects` | ≤1.16.0 | critical | sonatype-2026-008805 / 008818 | `npm audit fix` |
| `nanoid` | <3.3.18 | critical | CVE-2026-67213 | `npm audit fix` |
| `brace-expansion` | ≤5.0.11 | critical | sonatype-2026-008199 / 008204 | `npm audit fix` |
| `browserslist` | ≤4.28.6 | critical | CVE-2026-73088 | `npm audit fix` |
| `baseline-browser-mapping` | <2.11.0 | critical | CVE-2026-45819 | `npm audit fix` |
| `uuid` (next-auth's pin) | * | high | sonatype-2026-002676 | ⚠️ clears only with NextAuth v5 |
| `sprintf-js` | * | high | CVE-2026-97058 | ❌ no fix (chain: `gray-matter → js-yaml → argparse → sprintf-js`) |
| `js-yaml` | * | high | sonatype-2026-008704 | ❌ no fix (via gray-matter) |

### Recommended rollout

1. **Phase 1 — safe auto-fix.** Run `npm audit fix` (no `--force`). Clears
   next, postcss, sharp, source-map-js, axios, follow-redirects, nanoid,
   brace-expansion, browserslist, baseline-browser-mapping — i.e. 10 of 11
   criticals. Must be followed by `npm run build` and the test suites.
2. **Phase 2 — NextAuth v4 → v5 upgrade.** Clears the remaining `next-auth`
   critical and the `uuid` high. Breaking API changes:
   - `authOptions` export shape changes to `NextAuth({ ... })`.
   - `getServerSession(authOptions)` becomes `auth()`.
   - `useSession()` import path changes.
   - Needs touch-up in: `src/lib/auth.ts`, `src/lib/session.ts`, every API
     route using `getServerSession`, every `"use client"` component using
     `useSession`.
   Estimate: ~1 day of focused work + regression testing.
3. **Phase 3 — `gray-matter` chain.** Blog markdown parser pulls
   `sprintf-js` / `js-yaml` / `argparse`. Two options:
   - Accept the risk — markdown source is in-repo and trusted; no user
     input touches gray-matter at runtime.
   - Swap `gray-matter` for a slimmer YAML-free alternative
     (`@iarna/toml` + custom frontmatter split, or just use JSON
     frontmatter and `JSON.parse`). Low priority.

---

## S5.2.6 — Env var sweep

### Client bundle leak check

**Zero** `"use client"` files read `process.env.*` directly. The only
`NEXT_PUBLIC_*` vars shipped to the browser are:

- `NEXT_PUBLIC_APP_URL` — public site URL (safe by design)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — GA4 tracking ID (public by design)

No secret-looking env var is accessible from client code. ✅

### `.env.example` drift

**Used by code but not documented** (add to `.env.example`):

| Var | Where used | Secret? |
|---|---|---|
| `DATABASE_URL` | `src/lib/db-client.ts` | 🔴 Yes — Postgres connection string |
| `FOLLOW_GATE_SECRET` | `src/lib/follow-gate.ts` | 🔴 Yes — HMAC for follow-gate deep links |
| `OAUTH_STATE_SECRET` | `src/lib/oauth-state.ts` | 🔴 Yes — HMAC for OAuth state |
| `NEXT_PUBLIC_APP_URL` | `src/app/sitemap.ts`, `src/lib/seo.ts` | No — public URL |
| `RATE_LIMIT_MAX` | `src/lib/rate-limiter.ts` | No — tuning knob |
| `RATE_LIMIT_WINDOW_MS` | `src/lib/rate-limiter.ts` | No — tuning knob |
| `SENTRY_DSN` | `src/lib/monitoring.ts` | No (Sentry DSN is semi-public) |
| `SENTRY_DEBUG` | `src/lib/monitoring.ts` | No — flag |
| `SUPPORT_EMAIL` | `src/lib/email.ts` | No — public address |

Platform-injected vars (`NODE_ENV`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`)
don't need to go in `.env.example`.

**No orphans** — `DOCKER_BUILD` is read by `next.config.js:81` (toggles
`output: "standalone"`), not by any file under `src/`. Keep as-is.

---

## S5.2.7 — OWASP Top 10 static review

### 1. Auth bypass / Broken Access Control

Every sensitive route under `src/app/api/` authenticates via
`getSessionUserId()` (which wraps `getServerSession(authOptions)`). Admin
routes additionally gate on `isAdmin()`. Public endpoints that intentionally
skip the session check all use their own verification:

- `/api/webhook/instagram` — Meta `X-Hub-Signature-256` HMAC
- `/api/billing/webhook` — Razorpay signature
- `/api/csp-report`, `/api/health`, `/api/instagram/data-deletion` —
  intentionally unauthenticated (CSP reporting / health / Meta signed-request)
- `/api/auth/*` — pre-login lifecycle (register, forgot-password,
  reset-password, verify-email) gated by signed tokens

Verdict: **no auth bypass identified.** ✅

Minor note: `src/lib/session.ts:7-10` reads `session.user.id` rather than
`session.user.email`. Functionally equivalent in context, but worth
documenting as the convention.

### 2. IDOR

All ID-shaped endpoints perform an explicit ownership check *before*
calling the ID-only DB helper. Verified safe:

| Endpoint | Line range | Pattern |
|---|---|---|
| `PUT /api/automations` | 67-80 | `if (existing.user_id !== userId) 404` |
| `DELETE /api/automations` | 106-121 | same |
| `POST /api/automations/schedule` | 5-17 | same (403) |
| `PUT /api/accounts` | 92-95 | same |
| `DELETE /api/accounts` | 125-127 | same |
| `/api/billing/cancel`, `/api/billing/history` | — | resolve from `session.user.email`, no ID input |

No actual `src/app/api/automations/[id]/route.ts` dynamic route exists in
the current tree; the API uses body/query IDs with route-level ownership
guards.

**Defense-in-depth suggestion (optional, Low severity):** the DB helpers
themselves (`getAccount`, `deleteAccount`, `getAutomation`,
`deleteAutomation` in `src/lib/db.ts`) use ID-only SQL. If a future route
reuses these without the ownership check, IDOR becomes trivial. Push
`user_id` into the SQL `WHERE` clause as a second argument so the DB
enforces tenant isolation even if a route forgets.

Verdict: **no IDOR exploitable today.** ✅

### 3. XSS in DM template preview

`automation.dm_message` is rendered as a React text child inside a `<p>`
with `whitespace-pre-wrap` (`src/components/DashboardContent.tsx:1316-1319`).
React escapes `<`, `>`, quotes, and ampersands automatically.

Audit of every `dangerouslySetInnerHTML` in the repo (5 hits):

| File | What it renders | Trust source |
|---|---|---|
| `src/components/LandingContent.tsx:794` | hardcoded stats number | app-controlled |
| `src/app/layout.tsx:43-48` | inline GA snippet | app-controlled |
| `src/app/blog/[slug]/page.tsx:83` | JSON-LD via `JSON.stringify` | app-controlled |
| `src/app/blog/[slug]/page.tsx:116` | blog HTML from `gray-matter` | in-repo markdown, trusted |
| `src/app/docs/api/page.tsx:58` | docs HTML | in-repo markdown, trusted |

None of these render user-authored DM template content.

Verdict: **no XSS in DM preview.** ✅

### 4. SSRF in Instagram media fetch

All fetches to Meta / Razorpay use **fixed hosts**:

- `src/lib/instagram.ts:9-10` — `BASE_URL = https://graph.instagram.com/v21.0`
- `src/app/api/instagram/oauth/callback/route.ts:85-138` — fixed Meta OAuth endpoints
- `src/app/api/health/route.ts:91-93, 133-135` — fixed Graph API + Razorpay hosts
- `src/lib/instagram-subscription.ts:35-40, 78-82` — fixed `SUBSCRIBED_APPS_URL`

User-controlled values are interpolated as **path segments / IDs only**
(e.g. `${BASE_URL}/${commentId}/replies`), never as full URLs. The webhook
handler at `src/app/api/webhook/instagram/route.ts:185-194` reads
`value.from.id`, `value.id`, `value.media.id` from the signed Meta payload
and uses them as IDs, not URLs. The webhook itself is HMAC-verified at
lines 65-83 / 115-123.

No `fetch(mediaUrl)` where `mediaUrl` comes from a webhook payload or DB
field was found.

Verdict: **no SSRF exposure.** ✅

---

## Status against TASK_LIST S5.2

| # | Task | Status after this scan |
|---|---|---|
| 2.1 | `npm audit` + Next 15 / NextAuth v5 upgrade plan | 🟡 Scan done; auto-fix pending; NextAuth v5 upgrade still deferred |
| 2.6 | Env var sweep | 🟢 Done — client bundle clean; `.env.example` drift documented |
| 2.7 | OWASP Top 10 (auth bypass, IDOR, XSS, SSRF) | 🟢 Done — no exploitable finding; one defense-in-depth suggestion |

Still outstanding under S5.2 (unchanged by this scan): 2.2 (secret
rotation), 2.3 (CSP enforce), 2.4 (CSP report triage), 2.5 (Vercel WAF),
2.8 (security.txt), 2.9 (session cookie flags on prod domain), 2.10 (Neon
backup drill).
