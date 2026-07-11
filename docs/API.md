# DM Shiyam — API Documentation

Base URL: `https://dmshiyam.com`

All protected routes require authentication via session cookie (NextAuth).

---

## Authentication

### POST /api/auth/signin
Sign in with email/password or Google OAuth.

### POST /api/auth/forgot-password
**Body:** `{ email: string }`  
Sends password reset email.

### POST /api/auth/reset-password
**Body:** `{ token: string, password: string }`  
Resets password using token from email.

---

## Automations

### GET /api/automations
Returns all automations for the logged-in user.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "My Automation",
    "trigger_keywords": "link,price,info",
    "dm_message": "Hey {username}, here is the link!",
    "reply_comment": "Check your DMs!",
    "is_active": 1,
    "ai_enabled": 0,
    "schedule_enabled": 0,
    "schedule_start_hour": 9,
    "schedule_end_hour": 18,
    "schedule_days": "1,2,3,4,5"
  }
]
```

### POST /api/automations
Create a new automation.

**Body:**
```json
{
  "name": "string",
  "trigger_keywords": "link,price",
  "dm_message": "Hey {username}!",
  "reply_comment": "Check your DMs!",
  "ai_enabled": false
}
```

### PUT /api/automations
Update an existing automation.

**Body:** Same as POST, plus `id: string`

### DELETE /api/automations?id=uuid
Delete an automation by ID.

### PUT /api/automations/schedule
Update the schedule for an automation.

**Body:**
```json
{
  "id": "uuid",
  "schedule_enabled": true,
  "schedule_start_hour": 9,
  "schedule_end_hour": 18,
  "schedule_days": "1,2,3,4,5"
}
```

---

## Instagram Accounts

### GET /api/accounts
Returns all connected Instagram accounts for the user.

### POST /api/accounts
Connect a new Instagram account.

**Body:**
```json
{
  "access_token": "string",
  "instagram_account_id": "string",
  "username": "string"
}
```

### DELETE /api/accounts?id=uuid
Remove a connected Instagram account.

### POST /api/accounts/token
Refresh the Instagram access token for an account.

**Body:** `{ "account_id": "uuid" }`

---

## Activity Log

### GET /api/activity?limit=30
Returns recent activity log entries.

**Response:**
```json
[
  {
    "id": 1,
    "event_type": "dm_sent",
    "instagram_username": "testuser",
    "automation_name": "My Automation",
    "message": "DM sent successfully",
    "created_at": "2026-07-01T12:00:00Z"
  }
]
```

### GET /api/activity/export?format=csv
Downloads activity log as a CSV file.

**Query params:**
- `format=csv` (required)
- `start_date=YYYY-MM-DD` (optional)
- `end_date=YYYY-MM-DD` (optional)

### GET /api/activity/stream
SSE (Server-Sent Events) stream for real-time activity updates.

---

## Analytics

### GET /api/analytics?days=7
Returns analytics data for the given time range.

**Query params:** `days` — number of days (1, 7, 30)

**Response:**
```json
{
  "total_dms": 150,
  "total_replies": 45,
  "by_day": [
    { "date": "2026-07-01", "dms": 20, "replies": 5 }
  ],
  "top_keywords": [
    { "keyword": "link", "count": 80 }
  ]
}
```

---

## Stats

### GET /api/stats
Returns summary stats for the dashboard.

**Response:**
```json
{
  "total_dms_sent": 500,
  "dms_today": 12,
  "dms_this_week": 87,
  "active_automations": 3,
  "ai_replies": 24,
  "accounts_connected": 1,
  "plan": "pro",
  "dms_used_this_month": 120,
  "dm_limit": 500
}
```

---

## Billing (Razorpay)

### POST /api/billing/checkout
Create a Razorpay subscription checkout session.

**Body:** `{ "plan": "starter" | "pro" | "business" | "agency" }`

**Response:** `{ "subscription_id": "sub_xxx", "key_id": "rzp_xxx" }`

### POST /api/billing/verify
Verify payment after checkout completion.

**Body:**
```json
{
  "razorpay_payment_id": "pay_xxx",
  "razorpay_subscription_id": "sub_xxx",
  "razorpay_signature": "xxx"
}
```

### POST /api/billing/webhook
Razorpay webhook endpoint for subscription events.  
Requires `X-Razorpay-Signature` header.

---

## Webhook

### GET /api/webhook/instagram
Meta webhook verification handshake.

**Query params:**
- `hub.mode=subscribe`
- `hub.verify_token=YOUR_VERIFY_TOKEN`
- `hub.challenge=string`

### POST /api/webhook/instagram
Receives Instagram webhook events (comments, mentions, stories).  
Requires `X-Hub-Signature-256` header when `INSTAGRAM_APP_SECRET` is set.

### GET /api/webhook/health
Returns webhook connection health status.

**Response:**
```json
{
  "last_received_at": "2026-07-01 15:52:10",
  "last_event_type": "comments",
  "total_received": 42,
  "minutes_since_last": 5,
  "status": "healthy"
}
```

Status values: `healthy` (< 60 min), `stale` (60-1440 min), `never_received`

---

## AI

### POST /api/ai/test
Test the AI reply generation.

**Body:**
```json
{
  "commentText": "I want the link please",
  "commenterUsername": "john_doe",
  "staticDmTemplate": "Hey {username}, here is the link!",
  "mode": "dm"
}
```

**Response:**
```json
{
  "message": "Hey john_doe, here is the link!",
  "success": true,
  "error": null
}
```

---

## Cron Jobs

### GET /api/cron/refresh-tokens
Refreshes expiring Instagram access tokens for all users.  
Requires `Authorization: Bearer CRON_SECRET` header.

### POST /api/cron/reset-dm-usage
Resets monthly DM usage counters for all users.  
Requires `Authorization: Bearer CRON_SECRET` header.

---

## Admin

### GET /api/admin/stats
Returns platform-wide stats (admin only).

### GET /api/admin/users
Returns all users (admin only).

---

## Onboarding

### GET /api/onboarding
Returns current onboarding step for the user.

### POST /api/onboarding
Update onboarding step.

**Body:** `{ "step": 1 | 2 | 3 }`

---

## Error Responses

All endpoints return errors in this format:
```json
{ "error": "Error message here" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Not authenticated |
| 403 | Forbidden (wrong token/signature) |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
