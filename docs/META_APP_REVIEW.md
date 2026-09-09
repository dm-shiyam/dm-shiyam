# Meta App Review — instagram_business_manage_messages

## Permission Requested
**instagram_business_manage_messages** (Advanced Access) — Instagram API with Instagram Business Login (IBL, 2024+ flow)

Also required (Standard Access, auto-granted with IBL app setup):
- **instagram_business_basic** — read profile + media
- **instagram_business_manage_comments** — read + reply to comments

---

## App Review Submission Description

### How does your app use instagram_business_manage_messages?

> DM Shiyam is an Instagram automation tool for businesses and creators. It enables automated, personalized direct message (DM) responses triggered by specific keywords in Instagram post comments.
>
> **How it works:**
> 1. A business sets up an automation by choosing trigger keywords (e.g., "info", "pricing", "link") and a corresponding DM message template.
> 2. When an Instagram user comments on the business's post using one of those keywords, our app detects it via the Instagram Webhooks API.
> 3. The app automatically sends a personalized DM to the commenter with the relevant information (e.g., a product link, pricing details, or a welcome message).
> 4. Optionally, the app also replies to the comment publicly.
>
> **Why we need instagram_business_manage_messages (Advanced Access):**
> Our core feature requires sending the first DM to a user in response to their comment. With Standard Access, we can only message users who have already DM'd the business, which defeats the purpose of comment-triggered automations. Advanced Access allows us to initiate business-to-user conversations, which is essential for this use case.
>
> **User consent and anti-spam measures:**
> - DMs are only sent when a user explicitly engages by commenting a specific keyword — this is opt-in behavior.
> - Each user only receives one DM per automation per comment (duplicate prevention).
> - Businesses configure DM messages in advance — no unsolicited mass messaging.
> - Rate limiting is enforced (100 webhook requests/minute per IP).
> - Monthly DM usage limits are enforced per business plan.
>
> **Data handling:**
> - We only store the Instagram-scoped user ID and username from webhook events.
> - No personal data is shared with third parties.
> - Users can request data deletion per our Privacy Policy.

---

## Screencast Instructions

Record a 30–60 second screen recording showing:

1. **Dashboard** — Show the automation setup:
   - Keyword: "info"
   - DM message template: "Hey {username}! Thanks for reaching out..."
   - Reply comment: "Check your DMs!"

2. **Instagram Post** — Show a test user commenting "info" on a post

3. **Server Logs / Activity Tab** — Show the webhook being received, keyword matched, and DM sent

4. **Instagram DMs** — Show the DM received by the test user

> **Tip:** Use your ngrok URL + localhost for the demo. Meta doesn't require a production deployment.

---

## URLs to Provide

| Field | URL |
|---|---|
| Privacy Policy | https://dm-shiyam.vercel.app/privacy |
| Terms of Service | https://dm-shiyam.vercel.app/terms |
| App Website | https://dm-shiyam.vercel.app |

> **Verified live** (HTTP 200 on both, checked Sep 9 2026). Update to `dmshiyam.com` URLs once PR12-PR14 (domain cutover) is complete — re-submit if the app is already in review at that point.

---

## PR8 — Data Handling Questionnaire (ready to paste)

Meta's App Review → Data Handling step asks the questions below for each requested permission. Answers are sourced directly from `src/app/privacy/page.tsx` (the live Privacy Policy) — keep both in sync if either changes.

### What data does your app collect via `instagram_business_manage_messages`?
> We collect the Instagram-scoped user ID and username of the commenter (from the webhook `comment.from` field), the comment text that triggered the automation, and the timestamp of the interaction. We do not collect the commenter's email, phone number, or any other Instagram profile data beyond what Meta's webhook payload provides.

### How is this data stored?
> Data is stored in a PostgreSQL database (hosted on Neon), encrypted at rest and in transit (TLS/HTTPS). Access is restricted to authenticated application server processes only — no direct public access.

### How is this data used?
> Solely to: (1) match the Instagram-scoped user ID to a business's automation rules, (2) prevent duplicate DMs to the same commenter for the same automation, and (3) show the business owner an activity log of their automations in their own dashboard. Data is never used for advertising, profiling, or any purpose outside operating the requested automation.

### Is data shared with any third party?
> No. Data collected via this permission is not sold, rented, or shared with any third party. It is only accessible to: (a) the business owner who configured the automation, viewing their own activity log, and (b) our infrastructure providers (Neon for database hosting, Vercel for application hosting) strictly as data processors under standard hosting agreements — they do not access or use the data themselves.

### How long is this data retained?
> Activity logs (including the Instagram-scoped user ID and comment data captured via this permission) are automatically deleted after **90 days**. Users can request immediate deletion of all their data — including this permission's data — at any time.

### How can a user request deletion of their data?
> Any user (business owner or commenter) can email **dmshiyamofficial@gmail.com** to request full data deletion. Requests are processed within **30 days**, per our Privacy Policy (`https://dm-shiyam.vercel.app/privacy`, Section 4).

### Data Protection / Security Contact
> **Email:** dmshiyamofficial@gmail.com
> **Response time:** Within 30 days for data requests; security incidents are triaged immediately upon report.

---

## PR11 — Test Instagram Account for Meta Reviewers

Provide this test account so reviewers can exercise the full flow (comment → webhook → DM):

| Field | Value |
|---|---|
| Test IG account username | `dm_shiyam` |
| Test IG account type | Business |
| Login method for reviewer | Ask reviewer to use their own IG test account to comment on a `dm_shiyam` post — do **not** share `dm_shiyam`'s password/login. Meta reviewers should observe behavior, not log into your business account. |
| Demo automation keyword | `info` (see screencast instructions above) |
| Where reviewer can see the live flow | Comment "info" on any public post at `instagram.com/dm_shiyam` → reviewer's own IG account receives the automated DM within seconds |

> **Do not share the IG access token or account password in the App Review form.** Meta only needs to know *which public account* to test against and *what keyword* triggers the demo — not credentials. If Meta's form explicitly requires login credentials (rare, only for non-public flows), create a **separate throwaway test IG account** instead of using the real `dm_shiyam` production account.

---

## Checklist Before Submitting

- [x] Privacy Policy page is live and accessible (`/privacy` — verified HTTP 200)
- [x] Terms of Service page is live and accessible (`/terms` — verified HTTP 200)
- [ ] App description filled in Meta Dashboard → Settings → Basic
- [ ] App icon uploaded
- [ ] Business Verification completed (Settings → Basic → Business Verification)
- [ ] Screencast recorded and uploaded (PR7)
- [x] Data Handling questionnaire answers drafted above (PR8) — paste into Meta's form
- [ ] `instagram_manage_messages` requested for Advanced Access (PR9)
- [ ] `instagram_business_manage_messages` requested for Advanced Access (PR10)
- [x] Test account info drafted above (PR11) — paste into Meta's form
- [ ] Test user (Venkat/Ankit) available to demo the flow
