# Sentry Error Monitoring — Setup Guide

**Status:** Code is wired in. Just add DSN to Vercel env vars to activate.

Without `SENTRY_DSN` set, everything silently no-ops. Errors still show in Vercel logs via `console.error`.

---

## 1. Create Sentry Account (5 min)

1. Go to https://sentry.io/signup/
2. Sign up (free tier: 5,000 errors/month, 10,000 replays/month — plenty for launch)
3. Create a new project:
   - Platform: **Next.js**
   - Alert frequency: **Alert me on every new issue**
   - Project name: `dm-shiyam`

## 2. Grab Credentials

After project creation, Sentry shows a DSN string that looks like:
```
https://abc123def456@o1234567.ingest.us.sentry.io/7654321
```

Also grab:
- **Organization slug** — from URL: `sentry.io/organizations/<YOUR_ORG>/...`
- **Project slug** — `dm-shiyam` (or whatever you named it)
- **Auth token** — Settings → Auth Tokens → Create New → scope: `project:releases`. Used for source map uploads at build time.

## 3. Set Env Vars in Vercel

Vercel Dashboard → dm-shiyam project → Settings → Environment Variables:

| Name | Value | Environments |
|---|---|---|
| `SENTRY_DSN` | `https://abc...@sentry.io/7654321` | Production, Preview |
| `NEXT_PUBLIC_SENTRY_DSN` | same as above | Production, Preview |
| `SENTRY_ORG` | your org slug | Production, Preview |
| `SENTRY_PROJECT` | `dm-shiyam` | Production, Preview |
| `SENTRY_AUTH_TOKEN` | auth token from step 2 | Production, Preview |

**Do NOT** add these to `.env.local` — Sentry should stay off in local dev. If you want to test locally, set `SENTRY_DEBUG=1` temporarily.

## 4. Redeploy

Trigger a Vercel deployment (push any commit). Source maps upload on build, so stack traces will show real code line numbers.

## 5. Configure Alert Rules (PR18 — 5 min, 6 rules)

Sentry → Alerts → **Create Alert** → choose **Issues** → build each rule below exactly (Sentry UI: When / If / Then).

All rules assume the free tier's Issue Alert builder. Set **Environment: production** on every rule so local/preview noise doesn't page you.

### Rule 1 — Payment webhook processing failure (immediate)
- **When:** A new issue is created
- **If:** `tags[route]` equals `billing/webhook`
- **Then:** Send a notification to [Email — your address]
- **Action interval:** Immediately (no throttle)

### Rule 2 — Payment reconciliation mismatch (immediate)
- **When:** A new issue is created
- **If:** `tags[route]` equals `cron/reconcile-payments`
- **Then:** Send notification immediately
- *(Catches both the "Reconciliation cron ran without Razorpay keys" and "N mismatch(es)" alerts — both use this tag)*

### Rule 3 — Any cron job failure (immediate)
- **When:** A new issue is created
- **If (ANY of):**
  - `tags[route]` equals `cron/refresh-tokens`
  - `tags[route]` equals `cron/reset-dm-usage`
  - `tags[route]` equals `cron/send-onboarding-emails`
- **Then:** Send notification immediately
- *(3 separate `tags[route] equals` filter rows combined with "any" — Sentry's UI supports OR across filter rows)*

### Rule 4 — IG webhook signature failures ≥5 in 10 min (attack pattern)
- **When:** The issue is seen more than `5` times in `10 minutes`
- **If:**
  - `tags[route]` equals `webhook/instagram`
  - `level` equals `warning`
- **Then:** Send notification immediately
- *(Matches `"IG webhook: invalid signature"` capture — repeated hits = brute-force/replay attempt)*

### Rule 5 — Payment failures >10/hr (Razorpay `payment.failed` spike)
- **When:** The issue is seen more than `10` times in `60 minutes`
- **If:**
  - `tags[route]` equals `billing/webhook`
  - `level` equals `warning`
- **Then:** Send notification immediately
- *(Matches `"Razorpay payment failed"` capture — high failure rate = broken checkout, not just individual declined cards)*

### Rule 6 — Catch-all: any new issue, any route (daily digest)
- **When:** A new issue is created
- **If:** *(no filter — matches everything)*
- **Then:** Send notification, batched
- **Action interval:** Digest every 24 hours (avoids alert fatigue for low-severity one-offs not covered above)

### Optional — Rule 7: General error spike
- **When:** Number of events in an issue is more than `20` in `15 minutes`
- **If:** *(no filter)*
- **Then:** Send notification immediately
- *(Global safety net for anything unexpected outside the 6 monitored routes)*

## What's Captured

The following routes now report to Sentry:

| Route | What triggers a capture |
|---|---|
| `POST /api/webhook/instagram` | Signature failures (as warning), async processing errors (as error) |
| `POST /api/billing/webhook` | Signature failures (as warning), payment processing errors |
| `GET/POST /api/cron/refresh-tokens` | Missing creds, per-account failures, top-level exceptions |
| `GET/POST /api/cron/reset-dm-usage` | DB reset failures |
| `GET/POST /api/cron/send-onboarding-emails` | Per-user email failures, per-step failures |
| `GET/POST /api/cron/reconcile-payments` | Missing Razorpay keys, payment/subscription mismatches, top-level exceptions |

All server exceptions caught by Next.js's built-in error boundary → auto-forwarded via `onRequestError` hook in `instrumentation.ts`.

Client-side errors captured by `sentry.client.config.ts` — includes React error boundaries and unhandled promise rejections.

## Manual Capture Anywhere in Server Code

```typescript
import { captureError, captureAlert } from "@/lib/monitoring";

try {
  await doRiskyThing();
} catch (err) {
  captureError(err, { route: "my-route", user_id: userId });
  // Handle the error...
}

// Non-error alerts
captureAlert("Suspicious activity", { user_id: userId, ip }, "warning");
```

## Privacy — Automatic Redaction

`sentry.server.config.ts` scrubs before sending:
- Any header matching `authorization|cookie|x-hub-signature|token|secret` (case-insensitive)
- Query params: `access_token`, `token`, `secret`, `password`

Client-side (`sentry.client.config.ts`):
- Session Replay masks all user input text
- Session Replay blocks all media (images/video)

## Costs

Free tier is fine for launch phase (up to ~100 signups). Upgrade when you hit ~5k errors/month, which likely means you have a bigger problem to fix first.

## Rollback

To completely disable Sentry: unset `SENTRY_DSN` in Vercel → redeploy. Everything falls back to console logs.
