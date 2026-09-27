// src/lib/analytics.ts
// Thin, type-safe wrapper around window.gtag for firing GA4 events.
//
// Client-side only. Safe to call in SSR / non-browser contexts — becomes a
// no-op if window.gtag is unavailable (e.g. cookie-consent declined, ad
// blocker, tests, prerender).
//
// Docs: https://developers.google.com/tag-platform/gtagjs/reference/events

// ---------------------------------------------------------------------------
// Event catalog
// ---------------------------------------------------------------------------
// Keep this list *small and stable*. Every event here is a business
// conversion funnel step. If you find yourself adding a new event, ask
// whether the analytics team actually needs it as a first-class conversion
// in GA, or whether a generic `custom_event` with a `name` param is enough.
// ---------------------------------------------------------------------------

export type ConversionEvent =
  | {
      name: "signup_completed";
      params: {
        /** "credentials" | "google" */
        method: "credentials" | "google";
      };
    }
  | {
      name: "account_connected";
      params: {
        /** e.g. "instagram" — future-proofing for other channels */
        provider: "instagram";
        /** Optional IG username (no leading @) for debugging in DebugView */
        username?: string;
      };
    }
  | {
      name: "automation_created";
      params: {
        /** e.g. "comment_keyword" — matches automation.trigger_type */
        trigger_type: string;
        /** Number of keywords the user configured. 0 means catch-all. */
        keyword_count: number;
        /** Whether AI Smart Replies is enabled on this automation */
        ai_enabled: boolean;
      };
    }
  | {
      // S5.6.5 — funnel step only, fired at Checkout-button click time,
      // before Razorpay confirms payment. Not a conversion — plenty of
      // these are abandoned modals. The real conversion is
      // `subscription_started` below, fired server-side.
      name: "checkout_initiated";
      params: {
        /** Plan the user is attempting to upgrade to */
        plan: "starter" | "pro" | "business" | "agency";
        /** Amount in the smallest currency unit (paise for INR). */
        amount: number;
        /** ISO 4217 currency code. Razorpay charges INR. */
        currency: "INR";
      };
    }
  | {
      // S5.6.5 — the real conversion. Fired server-side from the Razorpay
      // webhook (src/app/api/billing/webhook/route.ts) the first time a
      // user's subscription becomes active — never on renewal charges.
      // See src/lib/analytics-server.ts.
      name: "subscription_started";
      params: {
        /** Plan the user is upgrading to */
        plan: "starter" | "pro" | "business" | "agency";
        /** Amount in the smallest currency unit (paise for INR). */
        amount: number;
        /** ISO 4217 currency code. Razorpay charges INR. */
        currency: "INR";
      };
    }
  | {
      // A9.1 — Fires once per browser the first time the dashboard observes an
      // activity_log entry with dm_sent=true. Guarded via localStorage so
      // reloads/polling don't refire. Represents the terminal step of the
      // activation funnel: signup → account_connected → automation_created →
      // first_dm_sent.
      name: "first_dm_sent";
      params: {
        /** Whether the DM was AI-generated (vs static template) */
        ai_generated?: boolean;
      };
    };

type EventParams = Record<string, string | number | boolean | undefined>;

type GtagFn = (
  command: "event" | "config" | "js" | "set",
  eventNameOrConfig: string,
  params?: EventParams
) => void;

type GtagGetFn = (
  command: "get",
  targetId: string,
  fieldName: string,
  callback: (fieldValue: string) => void
) => void;

declare global {
  interface Window {
    gtag?: GtagFn & GtagGetFn;
    dataLayer?: unknown[];
  }
}

/**
 * GA4 measurement id — same tag loaded in src/app/layout.tsx. Exported so
 * both the layout's <script> tag and getGaClientId() below stay in sync
 * with a single source of truth.
 */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-KDFFVFWBLC";

/**
 * Fire a GA4 conversion event. No-op in non-browser or when gtag is missing.
 *
 * @example
 *   trackEvent({ name: "signup_completed", params: { method: "credentials" } });
 */
export function trackEvent<E extends ConversionEvent>(event: E): void {
  if (typeof window === "undefined") return;
  const gtag = window.gtag;
  if (typeof gtag !== "function") return;

  try {
    gtag("event", event.name, event.params as EventParams);
  } catch (err) {
    // Never let analytics break the app. Log for debugging only.
    console.warn("[analytics] gtag call failed:", err);
  }
}

/**
 * Read GA4's client_id (the id behind the `_ga` cookie) so it can be
 * threaded through to a server-side flow — e.g. attached to the Razorpay
 * subscription's `notes` at checkout time, then read back in the webhook
 * to fire a server-side conversion (see src/lib/analytics-server.ts) that
 * still stitches to the browser session / acquisition channel that drove
 * the click.
 *
 * Resolves `undefined` (never throws) if gtag isn't loaded, consent was
 * declined, or the call doesn't answer within `timeoutMs` — callers should
 * proceed with checkout regardless.
 */
export function getGaClientId(timeoutMs = 300): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
      resolve(undefined);
      return;
    }

    const timer = setTimeout(() => resolve(undefined), timeoutMs);
    try {
      window.gtag("get", GA_MEASUREMENT_ID, "client_id", (clientId) => {
        clearTimeout(timer);
        resolve(clientId || undefined);
      });
    } catch (err) {
      clearTimeout(timer);
      console.warn("[analytics] getGaClientId failed:", err);
      resolve(undefined);
    }
  });
}
