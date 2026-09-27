// src/lib/analytics-server.ts
// Server-side GA4 conversion tracking via the Measurement Protocol.
//
// Used from webhook handlers (no browser, no gtag) to fire the *real*
// conversion once it's actually confirmed — e.g. `subscription_started`
// from the Razorpay webhook after payment, not at checkout-click time.
//
// Docs: https://developers.google.com/analytics/devguides/collection/protocol/ga4

import { captureError } from "@/lib/monitoring";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";

type ServerEventParams = Record<string, string | number | boolean>;

/**
 * Fire one GA4 event via the Measurement Protocol. Best-effort — never
 * throws; a failed analytics call must never break the caller (e.g. the
 * Razorpay webhook, which Razorpay will retry on any non-2xx response).
 *
 * No-ops if `GA4_API_SECRET` isn't configured (e.g. local dev).
 *
 * @param clientId GA4 client_id to attribute the hit to. Pass the id
 *   captured client-side via `getGaClientId()` at checkout time when
 *   available, so the conversion stitches back to the acquisition
 *   session/campaign. Falls back to a synthetic per-user id when the
 *   original client_id wasn't captured (older client, ad blocker, consent
 *   declined) — the event still counts toward revenue/volume, it just
 *   won't attribute to a specific channel.
 */
export async function trackServerEvent(
  clientId: string,
  name: string,
  params: ServerEventParams
): Promise<void> {
  const apiSecret = process.env.GA4_API_SECRET;
  if (!apiSecret) return;

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${apiSecret}`,
      {
        method: "POST",
        body: JSON.stringify({
          client_id: clientId,
          events: [{ name, params }],
        }),
      }
    );
    if (!res.ok) {
      captureError(new Error(`GA4 Measurement Protocol returned ${res.status}`), {
        route: "analytics-server",
        event: name,
      });
    }
  } catch (err) {
    captureError(err, { route: "analytics-server", event: name });
  }
}
