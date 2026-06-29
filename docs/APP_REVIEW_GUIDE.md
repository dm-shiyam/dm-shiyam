# Meta App Review Guide — `instagram_manage_messages`

This guide walks through everything needed to get **Advanced Access** for the `instagram_manage_messages` permission so DM Shiyam can send DMs to any user (not just testers).

---

## Why App Review Is Required

| Access Level | Who Can Receive DMs | Mode |
|---|---|---|
| **Standard (current)** | Only app testers, only in Development mode | Testing only |
| **Advanced (goal)** | Any Instagram user who interacts with your content | Production |

Without Advanced Access, the API returns:
```
(#3) Application does not have the capability to make this API call.
```

---

## Pre-Submission Checklist

### 1. Business Verification
- [ ] Go to **Business Settings** → **Security Centre** → **Start Verification**
- [ ] Provide legal business name, address, phone number
- [ ] Upload business documents (registration certificate, tax ID, utility bill, etc.)
- [ ] Verification typically takes **1–5 business days**
- [ ] URL: https://business.facebook.com/settings/security

### 2. App Configuration
- [ ] **Privacy Policy URL** is set and publicly accessible
  - Current: `https://<your-domain>/privacy`
  - Must be a permanent URL (not ngrok)
- [ ] **Terms of Service URL** is set (create `/terms` page if needed)
- [ ] **App Icon** is uploaded (1024×1024 PNG)
- [ ] **App Category** is set correctly
- [ ] **Contact Email** is set in App Settings → Basic
- [ ] **Data Deletion Callback URL** or **Data Deletion Instructions URL** is provided

### 3. Instagram Product Setup
- [ ] Instagram product is added to the app
- [ ] Instagram Business Account is connected to a Facebook Page
- [ ] Webhook is configured and subscribed to `comments` and `messages`

### 4. Permission-Specific Requirements

#### `instagram_manage_messages`
- **Use case**: "Manage messaging & content on Instagram"
- **Required proof**: Screen recording showing the full DM automation flow
- **What to demonstrate**:
  1. User creates an automation in the DM Shiyam dashboard
  2. A comment triggers the keyword match
  3. The bot sends a DM to the commenter
  4. The bot replies to the comment

---

## Submission Steps

### Step 1: Navigate to App Review
1. Go to https://developers.facebook.com/apps/YOUR_APP_ID/
2. Left sidebar → **App Review** → **Permissions and Features**
3. Find `instagram_manage_messages`
4. Click **Actions** → **Add to App Review**

### Step 2: Provide Use Case Details
Fill out the form with:

**Platform**: Web

**Describe how your app uses this permission**:
> DM Shiyam is an Instagram DM automation platform for businesses. When a user comments a specific keyword on an Instagram Business Account's post, our app automatically sends a personalized Direct Message to that user with relevant content (e.g., a link, coupon, or information). This helps businesses engage with their audience efficiently and respond to interest expressed through comments. The `instagram_manage_messages` permission is required to send these automated Direct Messages via the Instagram Messaging API.

**Steps to reproduce the feature**:
> 1. Log in to DM Shiyam dashboard
> 2. Connect an Instagram Business Account
> 3. Create an automation with trigger keyword "LINK" and a DM message
> 4. When someone comments "LINK" on your Instagram post, the app detects the keyword via webhook
> 5. The app sends an automated DM to the commenter with the configured message
> 6. The app also replies to the comment publicly

### Step 3: Record a Screencast
Record a **screen capture video** (MP4, max 2 minutes) showing:
1. Opening the DM Shiyam dashboard
2. Creating an automation (keyword + DM message + comment reply)
3. Posting a comment with the keyword on Instagram
4. The DM being received in the commenter's Instagram inbox
5. The comment reply appearing on the post

**Tips for the video**:
- Use a clean test account
- Show the full flow end-to-end
- Keep it under 2 minutes
- No audio required, but add captions if helpful

### Step 4: Submit
- Upload the screencast
- Review all fields
- Click **Submit for Review**

---

## After Submission

- **Review timeline**: Typically 3–10 business days
- **Status check**: App Review → Submissions
- **If rejected**: Meta will provide specific feedback — address it and resubmit
- **Common rejection reasons**:
  - Video doesn't clearly show the feature
  - Privacy policy is incomplete or inaccessible
  - Business verification not completed
  - Use case description is too vague

---

## Production Deployment Checklist (Post-Approval)

- [ ] Switch app to **Live** mode
- [ ] Replace ngrok URL with permanent domain in webhook callback
- [ ] Exchange all short-lived tokens for long-lived tokens (use `/api/accounts/token`)
- [ ] Set up token refresh cron job (every 50 days)
- [ ] Configure proper HTTPS with SSL certificate
- [ ] Set `NEXTAUTH_SECRET` to a secure random value
- [ ] Remove any test data from the database
- [ ] Set up error monitoring (e.g., Sentry)
- [ ] Set up uptime monitoring for webhook endpoint

---

## Useful Links

| Resource | URL |
|---|---|
| Meta App Dashboard | https://developers.facebook.com/apps/ |
| Business Verification | https://business.facebook.com/settings/security |
| Graph API Explorer | https://developers.facebook.com/tools/explorer/ |
| Instagram Messaging API Docs | https://developers.facebook.com/docs/instagram-api/guides/messaging |
| App Review Guidelines | https://developers.facebook.com/docs/app-review |
| Token Debugger | https://developers.facebook.com/tools/debug/accesstoken/ |
