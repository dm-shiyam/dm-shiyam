# DM Shiyam — Complete Setup Guide

> Comment-to-DM funnel automation for Instagram Business accounts.
> Includes AI Smart Replies (GPT), Analytics Dashboard, and Multi-Account Support.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Cost Breakdown](#cost-breakdown)
- [Phase 1: Instagram & Facebook Setup](#phase-1-instagram--facebook-setup)
- [Phase 2: App Configuration](#phase-2-app-configuration)
- [Phase 3: Webhook Setup](#phase-3-webhook-setup)
- [Phase 4: Run the App](#phase-4-run-the-app)
- [Phase 5: Optional Enhancements](#phase-5-optional-enhancements)
- [Phase 6: Authentication & Billing](#phase-6-authentication--billing)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

---

## Prerequisites

Before starting, create one **free Gmail account** (e.g., `dmshiyam.app@gmail.com`). Use this same email for all services below. A personal `@gmail.com` works for everything — no need for Google Workspace or a business email.

You'll need:
- A smartphone with the **Instagram app**
- A **Facebook account** (create one with your new Gmail if you don't have one)
- **Node.js 18+** installed on your computer ([nodejs.org](https://nodejs.org))
- A code editor (VS Code recommended)

---

## Cost Breakdown (USD)

| Service | Cost | Notes |
|---------|------|-------|
| **Instagram Graph API** | **FREE** | Official Meta API, no charges |
| **Meta Developer Account** | **FREE** | Just register at developers.facebook.com |
| **Instagram Business Account** | **FREE** | Switch in Instagram app settings |
| **Facebook Page** | **FREE** | Required to link your Instagram Business account |
| **ngrok (development)** | **FREE** | Free tier allows 1 tunnel, sufficient for dev/testing |
| **OpenAI API (AI Smart Replies)** | **PAID — ~$5 minimum** | ~$0.0001 per DM ($5 lasts ~50,000 DMs). Optional — app works without it |
| **Vercel (production hosting)** | **FREE tier available** | Hobby plan is free, Pro is $20/month |

### Cost Breakdown in Indian Rupees (₹) (using ~₹84 per USD)

| Service | Cost (₹) | Notes |
|---------|----------|-------|
| **Instagram Graph API** | **₹0 (FREE)** | Official Meta API, no charges |
| **Meta Developer Account** | **₹0 (FREE)** | Register at developers.facebook.com |
| **Instagram Business Account** | **₹0 (FREE)** | Switch in Instagram app settings |
| **Facebook Page** | **₹0 (FREE)** | Required to link Instagram |
| **ngrok (development)** | **₹0 (FREE)** | Free tier is enough for dev/testing |
| **OpenAI API (AI Smart Replies)** | **~₹420 minimum top-up** | Optional. ~₹0.008 per DM. ₹420 lasts ~50,000 DMs |
| **Vercel Hosting (production)** | **₹0 (FREE tier)** | Pro plan ₹1,680/month if needed |

### OpenAI Detailed Pricing in ₹

| Item | Cost |
|------|------|
| Minimum credit load | **₹420** (~$5) |
| Cost per AI-generated DM | **₹0.008** (less than 1 paisa) |
| 1,000 DMs | **₹8** |
| 10,000 DMs | **₹84** |
| 50,000 DMs | **₹420** |

### OpenAI Pricing Details (gpt-4o-mini)
- Input tokens: **$0.15 per 1M tokens** (~₹12.6 per 1M tokens)
- Output tokens: **$0.60 per 1M tokens** (~₹50.4 per 1M tokens)
- Average DM generation: ~300 tokens total → **~₹0.008 per DM**
- ₹420 credit ≈ **50,000 AI-generated DMs**
- You must add a credit/debit card at [platform.openai.com/settings/billing](https://platform.openai.com/settings/billing)
- **AI is completely optional** — the app works perfectly with static DM templates without it
- **To run without AI**: **₹0 total cost** — everything is free
- **To run with AI Smart Replies**: **₹420 one-time top-up** that lasts tens of thousands of DMs

---

## Phase 1: Instagram & Facebook Setup

### Step 1 — Create an Instagram Business Account

1. Download and open the **Instagram app** on your phone
2. Create a new account (use your new Gmail) or use an existing one
3. Tap your **profile picture** (bottom right) → tap **☰** (top right)
4. Go to **Settings and privacy → Account type and tools → Switch to professional account**
5. Choose **"Business"** (not Creator — Business gives full API access)
6. Select **"Product/Service"** or **"Software Company"** as your category (you can change this later)
7. Add contact info (optional but recommended)
8. Done — your account is now a Business account

### Step 2 — Create a Facebook Page

1. Go to [facebook.com/pages/create](https://facebook.com/pages/create)
2. Enter a **Page name** (use your Instagram handle or brand name)
3. Select **Category**: type "Product/Service" or "Software"
4. Add an optional **Bio/Description**
5. Click **Create Page**
6. You can skip adding profile pic/cover photo for now

### Step 3 — Link Instagram to Your Facebook Page

**Option A — From Meta Business Suite (recommended):**
1. Go to [business.facebook.com](https://business.facebook.com)
2. Click **Settings** (gear icon, bottom left)
3. Go to **Accounts → Instagram accounts**
4. Click **Add** → log in with your Instagram Business account credentials
5. This links your Instagram + Facebook Page automatically

**Option B — From Facebook Page:**
1. Go to your Facebook Page
2. Click **Settings** (bottom left on desktop)
3. Click **Linked Accounts** in the left sidebar
4. Under **Instagram**, click **Connect Account**
5. Log in to your Instagram Business account and approve

**Option C — From Instagram app:**
1. Open Instagram → tap your profile picture (bottom right)
2. Tap **☰** (top right) → **Settings and privacy**
3. Scroll to **Business tools and controls**
4. Tap **Linked accounts** → **Facebook**
5. Log in and select the Facebook Page you created in Step 2

### Step 4 — Create a Meta Developer Account

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **"Get Started"** (top right) or **"My Apps"**
3. Log in with the **same Facebook account** you used to create the Page
4. If prompted, click **"Register"** to become a Meta developer
5. Accept the Meta Platform Terms and Developer Policies
6. Verify your account with a **phone number** (required)
7. Once registered, you'll land on the **My Apps** dashboard

### Step 5 — Create a Meta App

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Click **"Create App"**
3. You'll see a use case selection screen:
   - Select **"Other"** → click **Next**
4. For app type, select **"Business"** → click **Next**
5. Fill in the details:
   - **App Name**: e.g., `DM Shiyam Bot`
   - **App Contact Email**: your Gmail
   - **Business Portfolio**: select your portfolio, or click **"Create a new business portfolio"** if none exists
6. Click **"Create App"**
7. You may need to re-enter your Facebook password
8. You'll land on the **App Dashboard** — this is your app's home page

### Step 6 — Add Instagram Product to Your App

**Finding Instagram in your app** (Meta changes this UI frequently — try in order):

**Option A — "Use cases" (newer dashboard):**
1. In the left sidebar, click **"Use cases"**
2. Find **"Authenticate and request data from Instagram users"** or **"Manage business Instagram accounts"**
3. Click **"Customize"** → this adds Instagram to your app
4. On the permissions page, make sure these are added/enabled:
   - `instagram_basic`
   - `instagram_manage_comments`
   - `instagram_manage_messages`
   - `pages_manage_metadata`
   - `pages_messaging`
5. For each one, click **"Add"** if not already added

**Option B — "Add products" (older dashboard):**
1. On the App Dashboard main page, scroll down to **"Add products to your app"**
2. Find the **"Instagram"** card and click **"Set up"**

**Option C — Already added:**
1. Check the left sidebar — if you see **Instagram** or **Facebook Login for Bus...** section, it's already added

### Step 6a — Add Instagram Tester (Required for Development Mode)

Your app is in **Development mode** (unpublished). You must add your Instagram account as a Tester before generating tokens.

1. In the left sidebar, go to **App roles → Roles**
2. Click the **"Instagram Testers"** tab at the top
3. Click **"Add Instagram Testers"**
4. Enter your Instagram username (e.g., `dm_shiyam`) and click **Submit**
5. Now **accept the invitation** on Instagram:
   - Open the **Instagram app** on your phone
   - Go to **☰ → Settings and privacy**
   - Search for **"app"** in settings search bar
   - Find **"Website permissions"** or **"Apps and websites"** or **"Sharing and reuse → Apps and websites"**
   - Look for a **"Tester invitations"** tab → **Accept** the invitation from your app
6. If you can't find it on the app, try [instagram.com](https://instagram.com) on desktop:
   - Log in → **Profile icon → Settings → Apps and websites → Tester invitations**

> **Note**: The invitation may take 2-3 minutes to appear. Force-close and reopen Instagram if needed.

### Step 6b — Generate Access Token

**Method 1 — From the Instagram API setup page:**
1. In the left sidebar, click **Instagram → API setup with Instagram Login**
2. Under **"Generate access tokens"**, you'll see your connected Facebook Pages
3. Click **"Generate token"** next to your Page
4. A popup will appear — log in to Instagram if prompted
5. Grant ALL requested permissions → click **"Generate token"**
6. **Copy the Access Token** — save it somewhere safe (you'll need it in Step 9)

**Method 2 — Via Graph API Explorer (if Method 1 gives errors):**
1. Go to [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. Top-right dropdown → select **your app**
3. Click **"User or Page"** dropdown → select **"Get Page Access Token"**
4. Authorize and grant all permissions when prompted
5. Select your Facebook Page
6. **Copy the token** from the Access Token field — this is your `INSTAGRAM_ACCESS_TOKEN`

> **Important**: This token expires in ~60 days. You'll need to regenerate it when it expires. For production, you should implement long-lived token refresh (covered in Phase 5).
>
> **Can't see your Facebook Page?** Make sure you completed Step 3 (linking Instagram to Facebook). Also ensure the Facebook Page and Instagram account are both added to the same Business Portfolio you selected in Step 5 (check at [business.facebook.com/settings](https://business.facebook.com/settings) → Accounts → Pages / Instagram accounts).
>
> **"Insufficient Developer Role" error?** This means either:
> 1. You haven't added your Instagram account as a Tester (Step 6a above)
> 2. You haven't accepted the tester invitation on Instagram
> 3. Your Page/Instagram aren't assigned to the app's Business Portfolio
> Try Method 2 (Graph API Explorer) as a workaround.

### Step 7 — Get Your Instagram Account ID

1. Go to the **Graph API Explorer**: [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. In the top-right dropdown, select **your app** (e.g., "DM Shiyam Bot")
3. In the **"User or Page"** dropdown, select **"Get User Access Token"**
4. Add these permissions: `instagram_basic`, `pages_show_list`, `pages_manage_metadata`, `pages_read_engagement`
5. Click **"Generate Access Token"** and approve the permissions
6. In the query field (next to GET), type and submit:
   ```
   /me/accounts
   ```
7. In the response, find your Facebook Page and **copy its `id`** (a long number)
8. Now change the query field to (replace `{page-id}` with the ID you copied):
   ```
   /{page-id}?fields=instagram_business_account
   ```
9. Click **Submit**. The response will show:
   ```json
   {
     "instagram_business_account": {
       "id": "17841400XXXXXXXXX"
     }
   }
   ```
10. **Copy this `id` value** — this is your `INSTAGRAM_ACCOUNT_ID`

> **Can't find your Page?** Make sure you completed Step 3 (linking Instagram to Facebook Page). If it still doesn't show, go to the Graph API Explorer dropdown and re-authorize with the correct Facebook account.

### Step 8 — Note Your App ID & Secret

1. In the Meta Developer Dashboard, go to **Settings → Basic**
2. Copy the **App ID** → this is your `INSTAGRAM_APP_ID`
3. Click **Show** next to App Secret and copy it → this is your `INSTAGRAM_APP_SECRET`

---

## Phase 2: App Configuration

### Step 9 — Configure Environment Variables

1. In your terminal, navigate to the project:
   ```bash
   cd /Users/priyanka.kore/Documents/instagram-dm-bot
   ```

2. Copy the example env file:
   ```bash
   cp .env.example .env.local
   ```

3. Open `.env.local` and fill in all values:
   ```env
   # From Step 8
   INSTAGRAM_APP_ID=123456789012345
   INSTAGRAM_APP_SECRET=abcdef1234567890abcdef

   # From Step 6
   INSTAGRAM_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxx

   # From Step 7
   INSTAGRAM_ACCOUNT_ID=17841400XXXXXXXXX

   # Make up a random secret string (anything you want)
   WEBHOOK_VERIFY_TOKEN=my_super_secret_verify_token_2024

   # Your public URL (from Step 10 — fill after starting ngrok)
   APP_URL=https://your-subdomain.ngrok-free.app

   # OPTIONAL: For AI Smart Replies (see Phase 5)
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Step 10 — Set Up ngrok (Public URL for Webhooks)

Instagram needs to reach your webhook endpoint. Since you're running locally, you need a tunnel.

1. Install ngrok:
   ```bash
   brew install ngrok
   ```

2. Sign up for free at [ngrok.com](https://ngrok.com) and get your auth token

3. Authenticate ngrok:
   ```bash
   ngrok config add-authtoken YOUR_NGROK_AUTH_TOKEN
   ```

4. Start the tunnel (keep this terminal open):
   ```bash
   ngrok http 3000
   ```

5. You'll see output like:
   ```
   Forwarding  https://a1b2c3d4.ngrok-free.app → http://localhost:3000
   ```

6. **Copy the https URL** and update `APP_URL` in your `.env.local`

---

## Phase 3: Webhook Setup

### Step 11 — Start Your Dev Server First

**Important**: Your server must be running BEFORE you register the webhook, because Meta will immediately send a verification request.

```bash
cd /Users/priyanka.kore/Documents/instagram-dm-bot
npm run dev
```

Verify it's running: open `http://localhost:3000` in your browser.

### Step 12 — Register Webhook with Meta

1. Go to your app in the **Meta Developer Dashboard**: [developers.facebook.com/apps](https://developers.facebook.com/apps) → click your app
2. In the left sidebar, click **Webhooks**
3. In the dropdown at the top, select **"Instagram"** (not "Page" or "User")
4. Click **"Subscribe to this object"** (or **"Edit callback URL"** if already set up)
5. Enter:
   - **Callback URL**: `https://your-tunnel-url.trycloudflare.com/api/webhook/instagram` (or ngrok URL)
   - **Verify Token**: the exact same string you put as `WEBHOOK_VERIFY_TOKEN` in `.env.local`
6. Click **"Verify and Save"**
7. If successful, you'll see a green checkmark ✅
8. Now subscribe to fields — check the box next to **`comments`** and click **Subscribe**
9. Also subscribe to **`messages`** if you want to track incoming DMs

> **If verification fails:**
> - Make sure **both** ngrok AND your dev server are running
> - Check the verify token matches **exactly** (case-sensitive, no extra spaces)
> - Make sure the ngrok URL uses **https**, not http
> - Try clicking "Verify and Save" again — sometimes Meta takes a second attempt

---

## Phase 4: Run the App

### Step 13 — Open the Dashboard

1. Go to `http://localhost:3000` — you'll see the landing page
2. Click **"Sign In"** → create an account with email/password (or use Google)
3. After login, you'll be redirected to the **Dashboard** at `/dashboard`

### Step 14 — Create Your First Automation

1. In the dashboard, click the **"New Automation"** button
2. Fill in the form:
   - **Automation Name**: e.g., "Free Guide Funnel"
   - **Instagram Account**: "Default (env vars)" or select a connected account
   - **Trigger Keywords**: e.g., `INFO, LINK, GUIDE, SEND`
   - **DM Message**:
     ```
     Hey {username}! 👋

     Thanks for your interest! Here's the link you requested:
     https://your-link.com/guide

     Let me know if you have any questions!
     ```
   - **Auto Comment Reply** (optional): `Just sent it to your DMs! 📩`
   - **AI Smart Replies**: Toggle ON if you've set up OpenAI (optional)
3. Click **"Create Automation"**

### Step 15 — Test It!

1. Make sure your dev server and ngrok are running
2. Post something on your **Instagram Business account**
3. From a **DIFFERENT Instagram account** (not the Business one), comment one of your trigger keywords (e.g., "INFO")
4. Watch the **Activity tab** in the dashboard — you should see:
   - The comment detected
   - DM sent status
   - Comment auto-reply status
5. Check the DMs on both accounts to verify

> **Note**: Instagram only allows DMs to users who have interacted with your Business account. A comment counts as an interaction, so the commenter will receive the DM.

---

## Phase 5: Optional Enhancements

### AI Smart Replies (OpenAI)

**Cost**: ~$5 minimum, lasts ~50,000 DMs

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an account (email + phone verification)
3. Go to **Settings → Billing** → Add a payment method
4. Add **$5** credit (minimum)
5. Go to **API Keys** → Create a new secret key
6. Copy the key (starts with `sk-`)
7. Add to your `.env.local`:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```
8. Restart your dev server (`npm run dev`)
9. When creating/editing an automation, toggle **"AI Smart Replies"** ON
10. Optionally customize the AI system prompt (e.g., "You are a friendly fitness coach...")

**What AI does**: Instead of sending the same static DM to everyone, AI reads each comment and crafts a personalized DM based on what the user said. The static DM template is used as context/fallback.

### Multi-Account Support

1. Go to the **Accounts** tab in the dashboard
2. Click **"Connect Account"**
3. For each additional Instagram Business account, enter:
   - **Instagram Username**: the @handle
   - **Instagram Account ID**: from Step 7 (repeat for each account)
   - **Access Token**: from Step 6 (generate a separate token per account)
   - **Facebook Page ID**: (optional)
4. When creating automations, select which account to use from the dropdown
5. Webhooks automatically route to the correct account based on the Instagram Account ID

### Analytics

The Analytics tab automatically tracks:
- **DMs sent over time** (line chart)
- **Top trigger keywords** (bar chart)
- **Delivery success rate** (pie chart)
- **Activity by hour** (heatmap)
- **Per-account breakdown** (if using multi-account)

Data populates as your automations run. Use the 7d/14d/30d/90d selector to change the time range.

---

## Phase 6: Authentication & Billing

### User Authentication (NextAuth.js)

The app uses **NextAuth.js** for authentication. Users can sign up/log in with **email + password** or **Google**.

#### Minimum Setup (email/password only)
Add to `.env.local`:
```env
NEXTAUTH_SECRET=any-random-string-abc123xyz
NEXTAUTH_URL=http://localhost:3000
```
That's it — email/password login works immediately.

#### Google Sign-In (optional)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
4. Application type: **Web application**
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy **Client ID** and **Client Secret**
7. Add to `.env.local`:
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your_secret_here
   ```

### Razorpay Billing

The app uses **Razorpay** for subscription billing. 5 plans: Free (₹0), Starter (₹499), Pro (₹1,999), Business (₹4,999), Agency (₹9,999).

#### Razorpay Setup
1. Sign up at [razorpay.com](https://razorpay.com) — free, no setup charges
2. Complete KYC verification (PAN + bank account)
3. Go to **Dashboard → Settings → API Keys** → Generate Key
4. Copy **Key ID** (starts with `rzp_test_`) and **Key Secret**
5. Go to **Dashboard → Products → Plans** → Create subscription plans:
   - **Starter**: ₹499/month
   - **Pro**: ₹1,999/month
   - **Business**: ₹4,999/month
   - **Agency**: ₹9,999/month
6. Copy each plan's **Plan ID** (starts with `plan_`)
7. Go to **Dashboard → Settings → Webhooks** → Add webhook:
   - URL: `https://your-domain.com/api/billing/webhook`
   - Secret: create a webhook secret
   - Events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.expired`
8. Add all values to `.env.local`:
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   RAZORPAY_PLAN_STARTER=plan_xxxxxxxxxxxxxx
   RAZORPAY_PLAN_PRO=plan_xxxxxxxxxxxxxx
   RAZORPAY_PLAN_BUSINESS=plan_xxxxxxxxxxxxxx
   RAZORPAY_PLAN_AGENCY=plan_xxxxxxxxxxxxxx
   ```

#### Razorpay Charges
- **No setup fee**
- **2% per transaction** (Razorpay's cut)
- Test mode is free — use `rzp_test_` keys for development

#### User Flow
1. User visits `/pricing` → sees all plans
2. Clicks "Upgrade" → Razorpay checkout opens
3. Pays via UPI/card/netbanking → payment verified → plan upgraded
4. User's DM limits and features unlock based on plan

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Webhook verification fails | Ensure ngrok + dev server are running. Check verify token matches exactly in `.env.local` and Meta dashboard |
| DMs not sending | The user must have interacted with your Business account first (Instagram policy). A comment = interaction |
| "Access token expired" | Tokens expire after ~60 days. Regenerate in Graph API Explorer and update `.env.local` |
| AI replies not working | Check `OPENAI_API_KEY` is correct in `.env.local`. Verify you have credits at platform.openai.com |
| "No Instagram Business Account" | Ensure you switched to Business (not Personal/Creator) and linked to a Facebook Page |
| ngrok URL changed | Free ngrok gives a new URL every restart. Update the webhook URL in Meta dashboard |
| Comments not triggering | Make sure the automation is "Active" and keywords match (case-insensitive) |
| Build errors | Run `npm install` then `npm run dev` |
| Login not working | Ensure `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set in `.env.local` |
| Google sign-in fails | Check redirect URI matches exactly: `http://localhost:3000/api/auth/callback/google` |
| Razorpay checkout fails | Verify `RAZORPAY_KEY_ID` and plan IDs are set. Use `rzp_test_` keys for dev |

---

## Project Structure

```
instagram-dm-bot/
├── .env.example              # Environment variable template
├── .env.local                # Your actual secrets (git-ignored)
├── package.json              # Dependencies
├── SETUP_GUIDE.md            # This file
├── BUSINESS_PLAN.md          # Business strategy & pricing
├── src/
│   ├── app/
│   │   ├── page.tsx          # Landing page
│   │   ├── layout.tsx        # Root layout (SessionProvider)
│   │   ├── login/
│   │   │   └── page.tsx      # Login / Signup page
│   │   ├── pricing/
│   │   │   └── page.tsx      # Pricing plans page
│   │   ├── dashboard/
│   │   │   └── page.tsx      # Dashboard (auth-protected, all tabs)
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/ # NextAuth handler (Google + credentials)
│   │   │   ├── billing/
│   │   │   │   ├── checkout/     # Razorpay subscription creation
│   │   │   │   ├── verify/       # Payment signature verification
│   │   │   │   └── webhook/      # Razorpay lifecycle events
│   │   │   ├── accounts/     # Multi-account CRUD API
│   │   │   ├── activity/     # Activity log API
│   │   │   ├── analytics/    # Analytics data API
│   │   │   ├── automations/  # Automations CRUD API
│   │   │   ├── stats/        # Dashboard stats API
│   │   │   └── webhook/
│   │   │       └── instagram/ # Webhook handler (AI + multi-account)
│   │   └── globals.css       # TailwindCSS styles
│   ├── components/
│   │   ├── Providers.tsx     # NextAuth SessionProvider wrapper
│   │   ├── AnalyticsTab.tsx  # Charts (Recharts)
│   │   └── AccountsTab.tsx   # Multi-account management UI
│   ├── lib/
│   │   ├── auth.ts           # NextAuth config (Google + email)
│   │   ├── plans.ts          # Pricing plan definitions
│   │   ├── db.ts             # SQLite database (users, accounts, automations, logs)
│   │   ├── instagram.ts      # Instagram Graph API (multi-account aware)
│   │   └── openai.ts         # OpenAI GPT integration
│   └── types/
│       └── index.ts          # TypeScript interfaces
└── dm-shiyam.db            # SQLite database file (auto-created)
```

---

## Quick Start (TL;DR)

```bash
# 1. Install dependencies
cd /Users/priyanka.kore/Documents/instagram-dm-bot
npm install

# 2. Configure environment (minimum for local testing)
cp .env.example .env.local
# Add at minimum:
#   NEXTAUTH_SECRET=any-random-string
#   NEXTAUTH_URL=http://localhost:3000

# 3. Start the app
npm run dev

# 4. Test locally
open http://localhost:3000        # Landing page
open http://localhost:3000/login  # Sign up / Log in
open http://localhost:3000/pricing # View plans

# 5. For Instagram integration: start ngrok (separate terminal)
ngrok http 3000

# 6. Register webhook at developers.facebook.com
# Callback URL: https://your-ngrok-url/api/webhook/instagram
```

---

*Built with Next.js 14, NextAuth.js, TailwindCSS, SQLite, Razorpay, Instagram Graph API, OpenAI GPT-4o-mini, and Recharts.*
