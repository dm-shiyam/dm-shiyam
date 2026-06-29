// lib/instagram.ts
// Fixed version — resolves DM-not-sending bug

const GRAPH_API_VERSION = "v19.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

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