// lib/instagram-subscription.ts
// After the OAuth flow completes, we must explicitly subscribe the connected
// Instagram account to receive webhook events (comments, messages) for OUR app.
// Without this call, Meta will not deliver any webhook events for that account,
// even if the App Dashboard shows the webhook endpoint as verified.
//
// Docs: https://developers.facebook.com/docs/instagram-platform/webhooks#subscribed-apps

const SUBSCRIBED_APPS_URL = "https://graph.instagram.com";

// Fields the account is subscribed to. Must match what is configured under
// Instagram API → Configure Webhooks in the Meta App Dashboard.
const SUBSCRIBED_FIELDS = ["comments", "messages"] as const;

export interface SubscribeResult {
  ok: boolean;
  subscribed_fields?: readonly string[];
  error?: {
    code?: number | string;
    type?: string;
    message: string;
    status?: number;
  };
}

/**
 * Subscribe the connected Instagram account to webhook events for our app.
 * Safe to call multiple times — Instagram treats it as idempotent.
 */
export async function subscribeAccountToWebhooks(
  instagramUserId: string,
  accessToken: string
): Promise<SubscribeResult> {
  try {
    const url = new URL(`${SUBSCRIBED_APPS_URL}/${instagramUserId}/subscribed_apps`);
    url.searchParams.set("subscribed_fields", SUBSCRIBED_FIELDS.join(","));
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString(), { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.success === false) {
      return {
        ok: false,
        error: {
          code: data?.error?.code,
          type: data?.error?.type,
          message: data?.error?.message || `HTTP ${res.status}`,
          status: res.status,
        },
      };
    }

    return { ok: true, subscribed_fields: SUBSCRIBED_FIELDS };
  } catch (err) {
    return {
      ok: false,
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Read the current subscription status for a connected account.
 * Useful for diagnostics — call GET to see which fields are subscribed.
 */
export async function getAccountSubscription(
  instagramUserId: string,
  accessToken: string
): Promise<{
  ok: boolean;
  data?: Array<{ subscribed_fields: string[] }>;
  error?: { message: string };
}> {
  try {
    const url = new URL(`${SUBSCRIBED_APPS_URL}/${instagramUserId}/subscribed_apps`);
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url.toString());
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: { message: data?.error?.message || `HTTP ${res.status}` },
      };
    }
    return { ok: true, data: data?.data ?? [] };
  } catch (err) {
    return {
      ok: false,
      error: { message: err instanceof Error ? err.message : String(err) },
    };
  }
}
