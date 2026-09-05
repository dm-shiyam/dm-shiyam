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
      name: "subscription_started";
      params: {
        /** Plan the user is upgrading to */
        plan: "starter" | "pro" | "business" | "agency";
        /** Amount in the smallest currency unit (paise for INR). */
        amount: number;
        /** ISO 4217 currency code. Razorpay charges INR. */
        currency: "INR";
      };
    };

type EventParams = Record<string, string | number | boolean | undefined>;

type GtagFn = (
  command: "event" | "config" | "js" | "set",
  eventNameOrConfig: string,
  params?: EventParams
) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

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
