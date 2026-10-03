# DM Shiyam — Instagram Comment-to-DM Bot

Automatically send personalized DMs when users comment specific keywords on your Instagram posts. Built with Next.js, TailwindCSS, and the official Instagram Graph API.

## Features

- **Keyword Triggers** — Define keywords that activate the bot (e.g., "INFO", "LINK", "PRICE")
- **Auto DMs** — Send personalized messages with `{username}` placeholder
- **Auto Comment Replies** — Optionally reply to the comment publicly
- **Dashboard** — Create/edit automations, view activity log, track stats
- **Webhook-Based** — Real-time processing via Instagram webhooks
- **Postgres Storage** — Production-grade Neon Postgres (migrated from SQLite in Sprint 2)

## Architecture

```
User comments "INFO" on your post
        ↓
Instagram sends webhook → /api/webhook/instagram
        ↓
Server matches keyword against active automations
        ↓
Sends DM via Instagram Messaging API
        ↓
Optionally replies to the comment
        ↓
Logs activity to dashboard
```

## Prerequisites

1. **Instagram Business or Creator Account** (free to switch in app settings — no linked Facebook Page required with the new Instagram Business Login flow)
2. **Meta Developer Account** at [developers.facebook.com](https://developers.facebook.com) with the **Instagram** product (API setup with Instagram Login) enabled
3. **Node.js 18+**
4. **Postgres database** (Neon free tier is enough for dev)

## Quick Start

### 1. Install dependencies

```bash
cd instagram-dm-bot
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your Instagram API credentials (see Setup Guide in the dashboard).

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the landing page.  
Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) to manage automations.

### 4. Expose for webhooks (local development)

```bash
ngrok http 3000
```

Use the ngrok URL as your webhook callback URL in Meta Developer dashboard.

## Instagram API Setup (Step by Step)

DM Shiyam uses the **Instagram API with Instagram Business Login** (IBL, 2024+). No Facebook Page or Facebook Login dependency.

1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → Business type
2. Products → **Add Instagram** → choose "API setup with Instagram Login"
3. Under **Business login settings** configure:
   - OAuth Redirect URI: `https://YOUR_DOMAIN/api/instagram/oauth/callback`
   - Deauthorize callback URL: `https://YOUR_DOMAIN/api/instagram/data-deletion`
   - Data Deletion Request URL: `https://YOUR_DOMAIN/api/instagram/data-deletion`
   - Scopes:
     - `instagram_business_basic`
     - `instagram_business_manage_comments`
     - `instagram_business_manage_messages`
4. Copy `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` into `.env.local`. Set `INSTAGRAM_REDIRECT_URI` to exactly match the URI registered above.
5. Users connect their IG account by clicking **Connect Instagram** on the dashboard — the app runs the OAuth code → short-lived → long-lived (60 day) token exchange and persists it per user.
6. Set up Webhooks:
   - Callback URL: `https://YOUR_DOMAIN/api/webhook/instagram`
   - Verify Token: same as `WEBHOOK_VERIFY_TOKEN` in `.env.local`
   - Subscribe to: `comments`, `messages`, `message_reactions`, `mentions` fields

## API Endpoints

Core routes below. The full, authoritative endpoint reference (auth, billing, admin, OAuth, cron, data deletion) is in [`docs/API.md`](./docs/API.md) and is rendered live at `/docs/api`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automations` | List all automations |
| POST | `/api/automations` | Create new automation |
| PUT | `/api/automations` | Update an automation |
| DELETE | `/api/automations?id=...` | Delete an automation |
| GET | `/api/activity` | Get activity log |
| GET | `/api/stats` | Get dashboard stats |
| GET/POST | `/api/webhook/instagram` | Instagram webhook endpoint |
| GET | `/api/instagram/oauth/authorize` | Start Instagram Business Login OAuth |
| GET | `/api/instagram/oauth/callback` | OAuth redirect handler (code → long-lived token) |
| POST | `/api/instagram/data-deletion` | Meta data-deletion callback |

## Project Structure

```
instagram-dm-bot/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── dashboard/page.tsx    # Dashboard UI
│   │   └── api/
│   │       ├── webhook/instagram/route.ts  # Webhook handler
│   │       ├── automations/route.ts        # Automation CRUD
│   │       ├── activity/route.ts           # Activity log
│   │       └── stats/route.ts              # Dashboard stats
│   ├── lib/
│   │   ├── db.ts                 # Postgres (node-postgres) database layer
│   │   └── instagram.ts          # Instagram Graph API integration
│   └── types/
│       └── index.ts              # TypeScript types
├── scripts/
│   ├── run-schema.mjs            # Applies schema.sql to the configured DATABASE_URL
│   ├── migrate-sqlite-to-pg.ts   # One-shot SQLite → Postgres data migration (Sprint 2)
│   └── test-*.{sh,mjs}           # Regression test runners (dedup, webhook E2E, billing, …)
├── schema.sql                    # Canonical Postgres DDL (idempotent)
├── .env.example
└── README.md
```

## Production Deployment

1. Deploy to Vercel / Railway / any Node.js host
2. Set environment variables on the platform (see `.env.example`)
3. Provision Postgres and run `node scripts/run-schema.mjs` once against the production `DATABASE_URL`
4. Update webhook URL + OAuth redirect URI in the Meta App Dashboard to the production domain
5. Submit the app for Meta App Review (required for Advanced Access on the three `instagram_business_*` scopes)
6. Users connect their accounts via the in-app **Connect Instagram** button — the OAuth callback automatically exchanges the short-lived code for a 60-day long-lived token and the daily `refresh-tokens` cron keeps it fresh

## License & Access

**Proprietary — internal use only.** This repository is not open source. All source code,
documentation, business logic, and assets are the confidential property of DM Shiyam
(Udyam-registered proprietorship, India). No part of this codebase may be copied,
redistributed, published, or used to derive another product without prior written
permission from the owner.

Access is restricted to authorized collaborators. If you landed here by mistake,
please close the tab and report the exposure to `contact@dmshiyam.com`.

