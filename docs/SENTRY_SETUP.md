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

## 5. Configure Alert Rules (5 min)

In Sentry → Alerts → Create Alert:

### Critical Alerts (email immediately)
- **Payment webhook failures** — filter: `tags[route]:billing/webhook` — fires on every occurrence
- **Cron failures** — filter: `tags[route]:cron/*` — fires on every occurrence
- **IG webhook signature failures** — filter: `tags[route]:webhook/instagram AND level:warning` — could indicate attack

### Standard Alerts (daily digest)
- **Any new error** — first occurrence of any issue → email
- **Error spike** — 20+ errors in 15 min → email

## What's Captured

The following routes now report to Sentry:

| Route | What triggers a capture |
|---|---|
| `POST /api/webhook/instagram` | Signature failures (as warning), async processing errors (as error) |
| `POST /api/billing/webhook` | Signature failures (as warning), payment processing errors |
| `GET/POST /api/cron/refresh-tokens` | Missing creds, per-account failures, top-level exceptions |
| `GET/POST /api/cron/reset-dm-usage` | DB reset failures |
| `GET/POST /api/cron/send-onboarding-emails` | Per-user email failures, per-step failures |

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
