// lib/instagram.ts
// Fixed version — resolves DM-not-sending bug

// IMPORTANT: Instagram Business Login tokens (prefix "IGAA...") only work
// against graph.instagram.com. Hitting graph.facebook.com with an IGBL token
// returns { code: 190, "Invalid OAuth access token" } → every DM silently fails.
// If we ever migrate back to Facebook Login user tokens (prefix "EAA..."),
// switch this back to graph.facebook.com.
const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.instagram.com/${GRAPH_API_VERSION}`;

// Retry config
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff

function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// Send a DM via the Instagram Messaging API
//
// FIX 1: Use /{ig-user-id}/messages (NOT /me/messages)
// FIX 2: Recipient must be { id: "<instagram_scoped_user_id>" }
//         The scoped user ID comes from the webhook payload
//         (entry[].changes[].value.from.id) — NOT the username
// FIX 3: Message body must be { text: "..." } nested inside `message`
// ─────────────────────────────────────────────
export async function sendDM(
  recipientId: string,   // Instagram-scoped user ID from webhook payload
  messageText: string,
  accessToken: string,
  igAccountId: string    // Your Instagram Business Account ID (INSTAGRAM_ACCOUNT_ID)
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const url = `${BASE_URL}/me/messages`;

  const body = {
    recipient: { id: recipientId },
    message: { text: messageText },
    messaging_type: "RESPONSE",
  };

  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[sendDM] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
        await sleep(delay);
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        lastError = data.error?.message ?? `HTTP ${res.status}`;
        console.error(`[sendDM] API error (attempt ${attempt + 1}):`, JSON.stringify(data.error ?? data));

        // Only retry on rate limits (429) and server errors (5xx)
        if (isRetryable(res.status) && attempt < MAX_RETRIES) continue;
        return { success: false, error: lastError };
      }

      return { success: true, messageId: data.message_id };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[sendDM] Fetch error (attempt ${attempt + 1}):`, lastError);

      // Retry on network errors
      if (attempt < MAX_RETRIES) continue;
      return { success: false, error: lastError };
    }
  }

  return { success: false, error: lastError };
}

// ─────────────────────────────────────────────
// V29 — Send a DM with a single quick-reply button (Follow-to-Unlock gate)
//
// Instagram Send API supports quick_replies of content_type 'text'. When the
// fan taps the button, Meta re-delivers our webhook with a `postback` entry
// containing the button's `payload` string. That's how the follow-gate
// button-tap round-trip works.
//
// Meta caps the DM at 1000 chars and each quick_reply title at 20 chars;
// we defensively trim to avoid a full API failure on a slightly-long user
// custom message. Payload has no strict length cap in current docs but we
// keep ours under 100 chars (see follow-gate.ts).
//
// This is a private_replies-eligible endpoint (POST /me/messages), so the
// SAME 24-hour messaging window applies as with a regular DM. Because our
// gate DM is itself the private reply to the comment, the fan is inside
// the messaging window for the entire follow_gate_timeout_seconds cap
// (which is why we cap that at 23h in db.ts).
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// V29.1 — Check whether a fan is following the business account.
//
// Uses the Instagram Messaging Platform's User Profile API:
//   GET /{IGSID}?fields=is_user_follow_business
//
// This is the SAME endpoint ManyChat uses for follow-gating. It requires:
//   - instagram_manage_messages permission (we already have it)
//   - The fan must have an open messaging window (a fresh comment opens it
//     for 24h; a DM does too). Since we call this either right after a
//     comment webhook OR on a postback tap, we're always inside the window.
//
// Returns:
//   { isFollower: true }   — verified follower
//   { isFollower: false }  — verified NON-follower
//   { isFollower: null }   — Meta wouldn't tell us (permission scope,
//                            rate-limit, endpoint temporarily unavailable
//                            for this user). Callers should fall back to
//                            trust-based behavior in the `null` case rather
//                            than blocking every user because one API call
//                            hiccuped.
//
// Rate limit: Meta caps this at ~200/hr per app user. At scale we'd need a
// short-lived cache keyed by IGSID; for MVP the per-fan volume is well
// under this.
// ─────────────────────────────────────────────
export async function checkIsFollower(
  igsid: string,
  accessToken: string
): Promise<{ isFollower: boolean | null; error?: string }> {
  const url = `${BASE_URL}/${igsid}?fields=is_user_follow_business`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      const msg = data.error?.message ?? `HTTP ${res.status}`;
      // Common failure: (#100) — Object with ID does not exist or lacks
      // permission. This happens when the user hasn't opted in to being
      // messaged by our app, or when the messaging window has closed.
      // We deliberately don't log noisily — trust fallback handles it.
      console.warn(`[checkIsFollower] Meta rejected for ${igsid}:`, msg);
      return { isFollower: null, error: msg };
    }
    // Field is a boolean when Meta returns it. Some accounts (rare) omit
    // it entirely — treat missing as `null` (unknown), NOT as `false`,
    // so we don't gate real followers out.
    if (typeof data.is_user_follow_business !== "boolean") {
      return { isFollower: null, error: "field_missing" };
    }
    return { isFollower: data.is_user_follow_business };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[checkIsFollower] Network error for ${igsid}:`, msg);
    return { isFollower: null, error: msg };
  }
}

export async function sendDmWithQuickReply(
  recipientId: string,
  messageText: string,
  button: { title: string; payload: string },
  accessToken: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const url = `${BASE_URL}/me/messages`;

  const body = {
    recipient: { id: recipientId },
    message: {
      text: messageText.slice(0, 1000),
      quick_replies: [
        {
          content_type: "text",
          title: button.title.slice(0, 20),
          payload: button.payload,
        },
      ],
    },
    messaging_type: "RESPONSE",
  };

  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[sendDmWithQuickReply] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
        await sleep(delay);
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        lastError = data.error?.message ?? `HTTP ${res.status}`;
        console.error(
          `[sendDmWithQuickReply] API error (attempt ${attempt + 1}):`,
          JSON.stringify(data.error ?? data)
        );
        if (isRetryable(res.status) && attempt < MAX_RETRIES) continue;
        return { success: false, error: lastError };
      }

      return { success: true, messageId: data.message_id };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[sendDmWithQuickReply] Fetch error (attempt ${attempt + 1}):`, lastError);
      if (attempt < MAX_RETRIES) continue;
      return { success: false, error: lastError };
    }
  }

  return { success: false, error: lastError };
}

// ─────────────────────────────────────────────
// Send a Private Reply (DM) in response to a comment
//
// Uses the current Instagram Messaging API:
//   POST /me/messages
//   { recipient: { comment_id: "<COMMENT_ID>" }, message: { text: "..." } }
//
// This does NOT require the 24-hour messaging window because the comment
// itself is the messaging trigger.
// Requires: instagram_manage_messages permission on the token.
// ─────────────────────────────────────────────
// Translate the most common cryptic Meta error strings into copy that a
// non-technical user can actually act on. Preserves the original as a hint
// in parentheses so debugging still works from just the activity_log row.
//
// Meta's real error messages we surface here come from:
//   * `POST /me/messages` (private_replies) — errors starting with "(#100)"
//   * `POST /{comment-id}/replies` — permission + validity errors
//   * Any endpoint — token expiry / revocation.
// Keep the mapping small and specific — a catch-all here would hide new
// failure modes we want to notice.
export function humanizeMetaError(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const s = raw.toLowerCase();

  if (s.includes("comment is invalid for a private reply")) {
    return "Meta rejected the private reply. Common causes: (1) comment is on a Story/Live/Ad — private_replies only works on Feed posts and eligible Reels; (2) commenter has blocked the account; (3) comment is >7 days old. (raw: " + raw + ")";
  }
  if (s.includes("access token") && (s.includes("expired") || s.includes("session"))) {
    return "Access token expired or was revoked. Reconnect this Instagram account from the Accounts tab. (raw: " + raw + ")";
  }
  if (s.includes("user has not authorized application")) {
    return "The Instagram user removed the app's permission. Reconnect via the Accounts tab. (raw: " + raw + ")";
  }
  if (s.includes("does not have permission")) {
    return "Missing Instagram permission for this action. Verify instagram_manage_comments + instagram_manage_messages are approved (App Review). (raw: " + raw + ")";
  }
  if (s.includes("(#4)") || s.includes("rate limit") || s.includes("application request limit")) {
    return "Instagram rate-limited this call. Automation will retry on the next matching comment. (raw: " + raw + ")";
  }
  return raw;
}

export async function sendPrivateReply(
  commentId: string,
  messageText: string,
  accessToken: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const url = `${BASE_URL}/me/messages`;

  const body = {
    recipient: { comment_id: commentId },
    message: { text: messageText },
  };

  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[sendPrivateReply] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
        await sleep(delay);
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        lastError = data.error?.message ?? `HTTP ${res.status}`;
        console.error(`[sendPrivateReply] API error (attempt ${attempt + 1}):`, JSON.stringify(data.error ?? data));

        if (isRetryable(res.status) && attempt < MAX_RETRIES) continue;
        return { success: false, error: lastError };
      }

      console.log(`[sendPrivateReply] DM sent for comment ${commentId} (message_id: ${data.message_id ?? "?"})`);
      return { success: true, messageId: data.message_id };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[sendPrivateReply] Fetch error (attempt ${attempt + 1}):`, lastError);

      if (attempt < MAX_RETRIES) continue;
      return { success: false, error: lastError };
    }
  }

  return { success: false, error: lastError };
}

// ─────────────────────────────────────────────
// Reply to a comment publicly
// ─────────────────────────────────────────────
export async function replyToComment(
  commentId: string,
  replyText: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${BASE_URL}/${commentId}/replies`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: replyText,
        access_token: accessToken,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const errMsg = data.error?.message ?? `HTTP ${res.status}`;
      console.error("[replyToComment] API error:", JSON.stringify(data.error ?? data));
      return { success: false, error: errMsg };
    }

    console.log(`[replyToComment] Success — new comment id: ${data.id ?? "(none)"} on parent ${commentId}`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[replyToComment] Fetch error:", message);
    return { success: false, error: message };
  }
}

// ─────────────────────────────────────────────
// Replace {username} placeholder in DM templates
// ─────────────────────────────────────────────
export function personalizeMessage(template: string, username: string): string {
  return template.replace(/\{username\}/gi, `@${username}`);
}