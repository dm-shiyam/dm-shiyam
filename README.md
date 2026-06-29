# DM Shiyam — Instagram Comment-to-DM Bot

Automatically send personalized DMs when users comment specific keywords on your Instagram posts. Built with Next.js, TailwindCSS, and the official Instagram Graph API.

## Features

- **Keyword Triggers** — Define keywords that activate the bot (e.g., "INFO", "LINK", "PRICE")
- **Auto DMs** — Send personalized messages with `{username}` placeholder
- **Auto Comment Replies** — Optionally reply to the comment publicly
- **Dashboard** — Create/edit automations, view activity log, track stats
- **Webhook-Based** — Real-time processing via Instagram webhooks
- **SQLite Storage** — Lightweight, no external database needed

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

1. **Instagram Business or Creator Account** (free to switch in app settings)
2. **Facebook Page** linked to your Instagram account
3. **Meta Developer Account** at [developers.facebook.com](https://developers.facebook.com)
4. **Node.js 18+**

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

1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → Business type
2. Add the **Instagram** product to your app
3. In Graph API Explorer, generate a token with these permissions:
   - `instagram_manage_comments`
   - `instagram_manage_messages`
   - `pages_manage_metadata`
   - `pages_messaging`
4. Get your Instagram Business Account ID:
   ```
   GET /me/accounts → get page_id
   GET /{page_id}?fields=instagram_business_account → get IG account ID
   ```
5. Set up Webhooks:
   - Callback URL: `https://YOUR_DOMAIN/api/webhook/instagram`
   - Verify Token: same as `WEBHOOK_VERIFY_TOKEN` in `.env.local`
   - Subscribe to: `comments` field

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automations` | List all automations |
| POST | `/api/automations` | Create new automation |
| PUT | `/api/automations` | Update an automation |
| DELETE | `/api/automations?id=...` | Delete an automation |
| GET | `/api/activity` | Get activity log |
| GET | `/api/stats` | Get dashboard stats |
| GET/POST | `/api/webhook/instagram` | Instagram webhook endpoint |

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
│   │   ├── db.ts                 # SQLite database layer
│   │   └── instagram.ts          # Instagram API integration
│   └── types/
│       └── index.ts              # TypeScript types
├── scripts/
│   └── init-db.js                # Database initialization
├── .env.example
└── README.md
```

## Production Deployment

1. Deploy to Vercel / Railway / any Node.js host
2. Set environment variables on the platform
3. Update webhook URL in Meta Developer dashboard
4. Submit app for Meta App Review (required for production access)
5. Exchange short-lived token for a long-lived token (60 days)

## License

MIT
