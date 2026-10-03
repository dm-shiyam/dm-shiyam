export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db";
import { query } from "@/lib/db-client";

// GET /api/billing/history
//
// Returns the current user's payment-lifecycle events (subscription
// activations, renewal charges, failed payments, refunds) sourced from
// the billing_events audit table that the Razorpay webhook writes to.
//
// We prefer this to hitting Razorpay's API every request because:
//   • Zero latency on cold reads — Neon index lookup, not a round-trip
//     to Razorpay (which is 300-800ms from Mumbai region).
//   • Already authenticated / scoped per-user (user_id FK).
//   • Idempotent — webhook delivery dedup via billing_events.event_id
//     means we never show a double entry even if Razorpay retried.
//
// Response: `{ events: BillingHistoryEntry[] }` ordered newest first.

type BillingHistoryEntry = {
  id: string;
  type:
    | "subscription_activated"
    | "payment_received"
    | "payment_failed"
    | "refund_initiated"
    | "subscription_cancelled"
    | "subscription_ended"
    | "other";
  label: string;
  amount_paise: number | null;
  currency: "INR";
  status: "success" | "failed" | "refunded";
  payment_id: string | null;
  plan: string | null;
  received_at: string; // ISO
};

function labelFor(eventType: string): {
  type: BillingHistoryEntry["type"];
  label: string;
  status: BillingHistoryEntry["status"];
} {
  switch (eventType) {
    case "subscription.activated":
      return { type: "subscription_activated", label: "Subscription activated", status: "success" };
    case "subscription.charged":
      return { type: "payment_received", label: "Payment received", status: "success" };
    case "payment.failed":
      return { type: "payment_failed", label: "Payment failed", status: "failed" };
    case "refund.created":
    case "refund.processed":
      return { type: "refund_initiated", label: "Refund initiated", status: "refunded" };
    case "subscription.cancelled":
      return { type: "subscription_cancelled", label: "Subscription cancelled", status: "success" };
    case "subscription.completed":
      return { type: "subscription_ended", label: "Subscription ended", status: "success" };
    default:
      return { type: "other", label: eventType, status: "success" };
  }
}

// Fish the paise amount out of the raw Razorpay payload. Different event
// types nest it differently (payment entity, refund entity, etc.) — try
// the most-specific locations first and fall back to null if none match.
function extractAmountPaise(raw: unknown): number | null {
  const r = raw as {
    payload?: {
      payment?: { entity?: { amount?: number } };
      refund?: { entity?: { amount?: number } };
      subscription?: { entity?: { plan_id?: string } };
    };
  };
  return (
    r?.payload?.payment?.entity?.amount ??
    r?.payload?.refund?.entity?.amount ??
    null
  );
}

function extractPaymentId(raw: unknown): string | null {
  const r = raw as {
    payload?: {
      payment?: { entity?: { id?: string } };
      refund?: { entity?: { payment_id?: string } };
    };
  };
  return (
    r?.payload?.payment?.entity?.id ??
    r?.payload?.refund?.entity?.payment_id ??
    null
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByEmail(session.user.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Only return events that are user-facing payment lifecycle (no raw
  // "subscription.pending", webhook health probes, etc.) to keep the UI
  // uncluttered. If an admin ever needs the full feed, they can hit
  // /api/admin/billing-events (not built yet, but a direct DB SELECT
  // in Neon works today).
  const rows = await query<{
    event_id: string;
    event_type: string;
    plan: string | null;
    raw_payload: unknown;
    received_at: Date;
  }>(
    `SELECT event_id, event_type, plan, raw_payload, received_at
     FROM billing_events
     WHERE user_id = $1
       AND event_type IN (
         'subscription.activated',
         'subscription.charged',
         'payment.failed',
         'refund.created',
         'refund.processed',
         'subscription.cancelled',
         'subscription.completed'
       )
     ORDER BY received_at DESC
     LIMIT 100`,
    [user.id]
  );

  const events: BillingHistoryEntry[] = rows.map((row) => {
    const meta = labelFor(row.event_type);
    return {
      id: row.event_id,
      type: meta.type,
      label: meta.label,
      amount_paise: extractAmountPaise(row.raw_payload),
      currency: "INR",
      status: meta.status,
      payment_id: extractPaymentId(row.raw_payload),
      plan: row.plan,
      received_at: row.received_at.toISOString(),
    };
  });

  return NextResponse.json({ events });
}
