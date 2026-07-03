# Meta App Review — instagram_manage_messages

## Permission Requested
**instagram_manage_messages** (Advanced Access)

---

## App Review Submission Description

### How does your app use instagram_manage_messages?

> DM Shiyam is an Instagram automation tool for businesses and creators. It enables automated, personalized direct message (DM) responses triggered by specific keywords in Instagram post comments.
>
> **How it works:**
> 1. A business sets up an automation by choosing trigger keywords (e.g., "info", "pricing", "link") and a corresponding DM message template.
> 2. When an Instagram user comments on the business's post using one of those keywords, our app detects it via the Instagram Webhooks API.
> 3. The app automatically sends a personalized DM to the commenter with the relevant information (e.g., a product link, pricing details, or a welcome message).
> 4. Optionally, the app also replies to the comment publicly.
>
> **Why we need instagram_manage_messages (Advanced Access):**
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
| Privacy Policy | https://unnerving-demote-briskness.ngrok-free.dev/privacy |
| Terms of Service | https://unnerving-demote-briskness.ngrok-free.dev/terms |
| App Website | https://unnerving-demote-briskness.ngrok-free.dev |

> **Note:** Before submitting, replace ngrok URLs with your production domain if deployed. Otherwise ngrok URLs work for review.

---

## Checklist Before Submitting

- [ ] Privacy Policy page is live and accessible
- [ ] Terms of Service page is live and accessible
- [ ] App description filled in Meta Dashboard → Settings → Basic
- [ ] App icon uploaded
- [ ] Business Verification completed (Settings → Basic → Business Verification)
- [ ] Screencast recorded and uploaded
- [ ] `instagram_manage_messages` requested under App Review → Permissions and Features
- [ ] Test user (Venkat/Ankit) available to demo the flow
