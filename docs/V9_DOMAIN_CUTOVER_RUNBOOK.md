# V9 — Custom Domain Cutover Runbook

**Objective:** Move production traffic from `dm-shiyam.vercel.app` → `dmshiyam.com`
without breaking OAuth, webhooks, or payments.

**Owner:** Venkat  |  **Blockers:** Priyanka (Meta + Razorpay), Ankit (Google OAuth)
**Expected wall-clock:** ~1 hour once DNS propagates.

---

## Pre-flight (before touching anything)

Run the health check on the current production domain to establish a
green baseline:

```bash
DOMAIN=https://dm-shiyam.vercel.app \
  node scripts/verify-domain-cutover.mjs
```

Expected: `0 critical, ≤1 warning`. If anything fails here, fix that first —
you do not want to chase existing bugs during the cutover.

---

## Step 1 — Add domain in Vercel  *(you, 5 min)*

1. https://vercel.com/dmshiyam41-7390s-projects/dm-shiyam/settings/domains
2. Add **`dmshiyam.com`** — Vercel will show DNS instructions.
3. Add **`www.dmshiyam.com`** too — configure it as a *redirect* to `dmshiyam.com`.
4. Copy the DNS records Vercel gives you.

## Step 2 — Set DNS records  *(you, 5 min + wait)*

Log into wherever the domain was bought (per V1.1 — likely Cloudflare or
Namecheap). Add the records from Step 1. Typical shape:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A     | @   | `76.76.21.21` (Vercel) | Auto |
| CNAME | www | `cname.vercel-dns.com` | Auto |

**Wait for propagation.** Verify from your machine:

```bash
dig dmshiyam.com +short          # should return the Vercel IP
dig www.dmshiyam.com +short      # should return cname.vercel-dns.com
```

Typical propagation: 5 min (Cloudflare) to a few hours (older registrars).

## Step 3 — Wait for SSL  *(automatic, ~2 min after DNS resolves)*

Vercel auto-issues Let's Encrypt certs. Check the Domains page — you'll
see a green ✓ next to each domain when the cert is live.

Verify:

```bash
DOMAIN=https://dmshiyam.com \
  node scripts/verify-domain-cutover.mjs
```

- Must pass check 1 (SSL + root page) and check 3 (/api/health).
- Check 2 (www redirect) may still be pending if Vercel is caching the
  redirect config — retry in 60 sec if it warns.

> **⚠  STOP HERE if step 3 fails.** Do not proceed until the app responds
> cleanly on `https://dmshiyam.com`. It's safe to leave the site in this
> "domain added but env vars not flipped" state indefinitely.

## Step 4 — Update env vars in Vercel  *(you, 3 min)*

Edit these in [Vercel env settings](https://vercel.com/dmshiyam41-7390s-projects/dm-shiyam/settings/environment-variables)
for the **Production** scope:

| Var | New value |
|-----|-----------|
| `APP_URL` | `https://dmshiyam.com` |
| `NEXTAUTH_URL` | `https://dmshiyam.com` |

Then trigger a redeploy:
- Vercel dashboard → Deployments → click ••• on latest → **Redeploy**.
- Or `git commit --allow-empty -m "chore: pick up new domain env vars" && git push`.

Once redeploy is `Ready`, re-run the verifier:

```bash
DOMAIN=https://dmshiyam.com node scripts/verify-domain-cutover.mjs
```

## Step 5 — Update Meta App Dashboard  *(Priyanka, 5 min)*

She owns Meta App `2422013218282805`. Ask her to update:

1. **OAuth Redirect URIs**  →  `https://dmshiyam.com/api/instagram/oauth/callback`
   *Keep the old Vercel URL too until we're 100% sure, then remove.*
2. **Webhook Callback URL**  →  `https://dmshiyam.com/api/webhook/instagram`
3. **Data Deletion Callback URL**  →  `https://dmshiyam.com/api/data-deletion`
4. **Deauthorize Callback URL**  →  `https://dmshiyam.com/api/deauthorize`

After she saves each one, hit "Verify and Save" in Meta so the webhook
handshake runs against our new domain.

**Verify locally:** open an incognito window → `https://dmshiyam.com/login`
→ log in → try Connect Instagram. If Meta throws an "invalid redirect URI"
error, the whitelist doesn't match yet.

## Step 6 — Update Razorpay webhook URL  *(Priyanka, 3 min)*

Razorpay Dashboard → Settings → Webhooks → Edit the existing webhook:

- **URL** → `https://dmshiyam.com/api/billing/webhook`
- **Events:** keep the existing selection (subscription.*, payment.*)
- **Secret:** unchanged (must still match `RAZORPAY_WEBHOOK_SECRET` in Vercel).

Verify with a test event from the Razorpay dashboard — should return 200.

## Step 7 — Update Google OAuth authorized URIs  *(Ankit, 3 min)*

Google Cloud Console → APIs & Services → Credentials → the OAuth 2.0
Client → **Authorized redirect URIs**:

- Add:    `https://dmshiyam.com/api/auth/callback/google`
- Add:    `https://dmshiyam.com` (for authorized origins)
- Keep the old Vercel URL for 24 hours as a safety net, then remove.

## Step 8 — Final full-stack verification

```bash
# Should return: ✅ All checks passed
DOMAIN=https://dmshiyam.com node scripts/verify-domain-cutover.mjs
```

Then manually test the three critical user flows in an incognito window:

- [ ] Sign up with email → land on dashboard
- [ ] Log in with Google → land on dashboard
- [ ] Connect Instagram (OAuth) → toast success, account shows on Accounts tab
- [ ] Trigger a real IG comment → verify DM sent + activity feed shows it
- [ ] Open Pricing → click Upgrade → verify Razorpay checkout loads

---

## Rollback (if anything goes sideways)

The old Vercel URL keeps working the entire time — nothing is destructive.
To roll back:

1. In Vercel, flip `APP_URL` and `NEXTAUTH_URL` back to `https://dm-shiyam.vercel.app`.
2. Redeploy.
3. Tell Priyanka + Ankit to revert their console changes (they should have
   kept the old URLs as a fallback per steps 5-7).

The custom domain stays attached to the project harmlessly — no need to
remove it during rollback.

---

## Definition of Done

- [ ] `verify-domain-cutover.mjs` exits 0 against `https://dmshiyam.com`
- [ ] All three manual E2E flows pass in incognito
- [ ] `dm-shiyam.vercel.app` still works (fallback preserved)
- [ ] Meta App Dashboard shows all 4 URLs on the new domain
- [ ] Razorpay webhook shows successful `ping` from new URL
- [ ] Google OAuth accepts new domain in redirect URI list
- [ ] TASK_LIST.md V9.1–9.6 marked ✅ Done with commit SHA
