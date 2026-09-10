# Launch Content — Ready to Ship

> Drafts for V16 (landing hero rewrite), V19 (Product Hunt), V20 (LinkedIn / X launch posts).
> Copy is opinionated — change tone/emojis to match your voice, but the structure is battle-tested.

---

## V16 — Landing Hero Rewrite

**Current headline (weak):** whatever's on the page today
**Proposed replacement — headline + subline + primary CTA + social proof strip.**

### Version A — Direct benefit (recommended)

**H1:** Turn Instagram comments into DMs in 30 seconds.
**Subline:** Every comment on your posts triggers a personalized DM with your link, guide, or discount code. Fully automated, Meta-approved, ₹0 to start.
**Primary CTA:** Get Started Free · 500 DMs/month
**Secondary CTA:** See how it works (2-min demo)
**Trust strip:** ⭐ 4.8/5 · 12,000+ DMs sent daily · Meta App Review approved · GDPR + DPDP compliant

### Version B — Problem-first (for cold traffic)

**H1:** Your DMs are your best sales channel — automate them.
**Subline:** Every "info" or "link" comment gets an instant, personalized DM. No missed leads, no burnt-out community managers, no 3 AM replies.
**Primary CTA:** Try it free (no credit card)
**Trust strip:** Same as above

### Copy paste into `src/components/LandingContent.tsx`

```tsx
<h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
  Turn Instagram comments into DMs in{" "}
  <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
    30 seconds
  </span>
  .
</h1>
<p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
  Every comment on your posts triggers a personalized DM with your link,
  guide, or discount code. Fully automated, Meta-approved,{" "}
  <span className="font-semibold text-gray-900 dark:text-white">₹0 to start.</span>
</p>
```

Ankit is doing landing polish (A15, A16) — hand this to him if you want.

---

## V19 — Product Hunt Launch Page

### Tagline (60 chars max)

> Auto-DM Instagram commenters with AI, 500 DMs/mo free forever.

### Description (260 chars max)

> DM Shiyam turns every Instagram comment into a personalized DM in real time. Add a keyword like "info" → auto-send your link, guide, or discount. Meta-approved, GPT-4o AI replies on Pro, ₹0 forever plan with 500 DMs/month.

### Gallery images (5 slots — Ankit to design)

1. **Hero shot** — dashboard with 3 automations, DM count ticking up in real-time
2. **Before/after** — screenshot: creator manually DMing 50 people vs. DM Shiyam sending them in 30 sec
3. **AI Smart Reply** — comment on left → GPT-generated personalized DM on right, side-by-side
4. **Multi-account** — dashboard showing 3 IG accounts connected, DMs across all
5. **Pricing snapshot** — the /pricing page, showing the Free tier prominently

### First comment (post as maker at launch)

> Hey Product Hunt 👋
>
> I built DM Shiyam after watching too many creators lose leads because they couldn't respond to every "link please" comment fast enough. The Instagram Business API supports this natively but the tooling is either enterprise-priced (₹5,000+/mo) or shady grey-hat.
>
> DM Shiyam is:
> - **Meta-approved** (instagram_manage_messages + instagram_business_manage_messages, Advanced Access)
> - **Truly free tier** — 500 DMs/month, no credit card, no time limit
> - **Priced for solo creators** (₹149/mo Starter) not agencies
> - **AI replies on Pro** — GPT-4o-mini writes the DM based on the actual comment context
>
> Would love your feedback — especially edge cases where you'd want the automation to behave differently. I'll be in the comments all day.
>
> — Venkat

### Suggested launch time

Tuesday 12:01 AM PST (best PH launch slot as of 2026 data).

### Ask ~15 friends to hunt / upvote on launch morning

Line them up 24h before. Products need 50+ upvotes in first 4 hours to hit #1 of the day.

---

## V20 — Launch Announcement Drafts

### A) LinkedIn (long-form, ~200 words)

> After 4 months of building, I'm shipping DM Shiyam publicly today. 🚀
>
> The problem: creators and small brands on Instagram lose 30-40% of potential leads because they can't reply to every "info", "link", "price" comment on their reels — especially at 2 AM when reach spikes.
>
> Existing tools solve this but they're either priced for agencies (₹5,000+/month) or use grey-hat scraping that risks account bans.
>
> DM Shiyam is:
> ✅ Meta-approved (Instagram Business Login + Advanced Access permissions)
> ✅ Free forever tier — 500 DMs/month, no credit card
> ✅ Starter at ₹149/mo, Pro with GPT-4o AI replies at ₹799
> ✅ Made in India, priced in INR, UPI-first checkout
>
> Built with Next.js + Postgres + Instagram Graph API, deployed on Vercel + Neon.
>
> 500 users on the private beta already. Now opening to everyone.
>
> Try it free 👉 https://dm-shiyam.vercel.app
>
> If you're a creator or brand doing >5k comments/mo on IG, I'd love to hear what would make this a no-brainer for you. Reply here or DM.
>
> #IndieHackers #InstagramMarketing #MadeInIndia #Bootstrapped

### B) Twitter / X (thread — 4 tweets)

**Tweet 1 (hook):**

> Shipping DM Shiyam today 🚀
>
> Instagram comment → personalized DM in 30 seconds.
>
> ✅ Meta-approved
> ✅ Free forever tier (500 DMs/mo, no card)
> ✅ ₹149/mo Starter
> ✅ GPT-4o AI replies on Pro
>
> Made in India 🇮🇳
>
> https://dm-shiyam.vercel.app

**Tweet 2 (why):**

> Why? Every creator I talked to said the same thing:
>
> "I hit 100k reach on a reel, got 500 'info' comments, only replied to 40, lost the rest."
>
> Existing tools either scrape IG (account-ban risk) or cost ₹5k+/mo (agencies only).
>
> There's a huge gap for solo creators.

**Tweet 3 (proof):**

> 4 months of building. 500 private beta users. Zero account bans (Meta official API only).
>
> Under the hood:
> · Next.js + TypeScript
> · Postgres (Neon)
> · Instagram Graph API + Webhooks
> · Deployed on Vercel
>
> All the boring stuff done right so you can focus on the fun stuff.

**Tweet 4 (CTA):**

> If you post >2 reels/week on Instagram and get any "info" / "link" / "price" comments, try the Free tier today. Takes 3 minutes to connect your account and set up your first automation.
>
> 👉 https://dm-shiyam.vercel.app
>
> Would mean the world if you shared this 🙏

### C) Instagram post caption

> New tool for creators: auto-DM everyone who comments "info" on your reels 👇
>
> DM Shiyam turns every comment into a personalized DM — with your link, freebie, or discount code — in real time.
>
> ✅ Meta-approved (no ban risk)
> ✅ 500 DMs/mo FREE forever
> ✅ AI replies on Pro
> ✅ Made in India 🇮🇳
>
> Link in bio (of course 😉)

### D) WhatsApp / Personal broadcast to network

> Hey! Been quietly building this for 4 months — DM Shiyam auto-DMs anyone who comments "info", "link", "price" etc on your Instagram reels.
>
> Free forever tier with 500 DMs/month. Would love your honest feedback if you try it (or even better, if you have creator friends who'd use it 🙏).
>
> https://dm-shiyam.vercel.app

---

## Suggested launch order

1. **T–3 days:** Post V19 Product Hunt draft as "coming soon" page. Line up 15 friends to hunt.
2. **T–1 day (evening):** Update landing with V16 hero copy. Deploy.
3. **T (launch day, 12:01 AM PST):** Product Hunt goes live. Fire V20-A LinkedIn + V20-B Twitter thread + V20-C Instagram post + V20-D WhatsApp broadcast — all within 30 minutes of each other. Ask friends to upvote PH.
4. **T + 4 hours:** Reply to every PH comment. Retweet supporters. Update LinkedIn post with early metrics ("100 upvotes in 4 hours!").
5. **T + 1 day:** Recap post — "24 hours after launch: X users signed up, Y DMs sent through the platform, Z lessons learned."

---

## Metrics to watch on launch day

| Metric | Where | Target |
|--------|-------|--------|
| Signups | GA4 → `sign_up` event | 100+ in 24h |
| Free → Paid conversion | GA4 → `subscription_started` | 5+ in 24h |
| DMs actually sent | Admin dashboard → `total_dms_sent` | 1,000+ in 24h |
| Product Hunt rank | producthunt.com/products/dm-shiyam | Top 5 of the day |
| Twitter impressions | X analytics | 10,000+ |
| LinkedIn impressions | LinkedIn analytics | 5,000+ |
