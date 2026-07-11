# Google Search Console Setup for DM Shiyam

Complete guide for task 6.4 — Submit to Google Search Console

---

## Step 1: Verify Your Domain in GSC

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Click **Add property**
3. Enter your domain: `dmshiyam.com`
4. Choose **URL prefix** (not domain property, since you may not own all subdomains)
5. Click **Continue**

### Verify ownership (choose one method):

**Option A: HTML file upload** (easiest for Next.js)
- Download the verification HTML file
- Place it in `public/` folder
- Deploy and wait 24-48 hours for verification

**Option B: DNS record**
- Add TXT record to your domain DNS
- Propagation can take up to 48 hours

**Option C: Google Analytics / Google Tag Manager**
- If you're already using GA or GTM, GSC can verify automatically

---

## Step 2: Submit Your Sitemap

1. In GSC, go to **Sitemaps** (left sidebar)
2. Enter sitemap URL: `https://dmshiyam.com/sitemap.xml`
3. Click **Submit**
4. Wait for GSC to crawl it (usually 24-48 hours)

✅ You should see:
- Sitemap submitted successfully
- Number of URLs in sitemap: 5 (home, pricing, privacy, terms, register)

---

## Step 3: Submit Robots.txt

1. Go to **Settings** → **Crawl Stats**
2. GSC automatically detects `robots.txt` from `https://dmshiyam.com/robots.txt`
3. You should see crawl statistics after a few hours

---

## Step 4: Request URL Indexing (Optional)

1. Go to **URL Inspection** (top search bar)
2. Paste each URL you want to index immediately:
   - `https://dmshiyam.com`
   - `https://dmshiyam.com/pricing`
   - `https://dmshiyam.com/privacy`
   - `https://dmshiyam.com/terms`
3. Click **Request Indexing**

---

## Step 5: Monitor Performance

After 2-4 weeks, check:

1. **Coverage report** — See which pages are indexed
2. **Core Web Vitals** — Monitor page speed, interactivity, layout stability
3. **Enhancements** — Any issues GSC detects
4. **Search results** — Your pages should appear in Google Search

---

## What You've Done ✅

- **6.1** — Meta title, description, keywords on all pages (added in `lib/seo.ts` + page metadata)
- **6.2** — Open Graph and Twitter Card tags (included in defaultMetadata)
- **6.3** — sitemap.xml auto-generated, robots.txt created
- **6.4** — Submitted to Google Search Console

---

## Deployment Checklist

Before going live, ensure:

```bash
# 1. Update environment variable
NEXT_PUBLIC_APP_URL=https://dmshiyam.com

# 2. Deploy to production
npm run build
# Deploy to Railway/Render/Vercel

# 3. Test live URLs
curl https://dmshiyam.com/sitemap.xml
curl https://dmshiyam.com/robots.txt

# 4. Add to GSC
# Visit Google Search Console and submit sitemap
```

---

## Monitoring Long-term

- **Weekly:** Check GSC for errors/warnings
- **Monthly:** Review search performance and Core Web Vitals
- **Quarterly:** Update sitemap if you add new pages

---

## FAQ

**Q: How long does indexing take?**
A: 2-7 days for first index, up to 4 weeks for full coverage.

**Q: Do I need to resubmit the sitemap?**
A: No, GSC checks automatically. But you can manually resubmit after major changes.

**Q: Can I see search impressions yet?**
A: Yes, after 2-4 weeks in the Performance report.

**Q: What if pages aren't indexed?**
A: Check Coverage report for reasons. Common issues: robots.txt blocking, noindex tags, canonicalization.