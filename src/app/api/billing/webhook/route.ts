import { NextRequest, NextResponse } from "next/server";
import {
  getUserById,
  updateUserPlan,
  tryRecordBillingEvent,
  finalizeBillingEvent,
} from "@/lib/db";
import { PLANS } from "@/lib/plans";
import type { PlanType } from "@/types";
import crypto from "crypto";
import { captureError, captureAlert } from "@/lib/monitoring";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  // ── 1. Signature verification (defense-in-depth against forged webhooks) ──
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "")
    .update(body)
    .digest("hex");

  const sigValid =
    signature !== null &&
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!sigValid) {
    captureAlert(
      "Razorpay webhook: invalid signature",
      { route: "billing/webhook", ip: request.headers.get("x-forwarded-for") ?? "" },
      "warning"
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── 2. Parse event ──
  let event: {
    id?: string;
    event: string;
    payload: {
      subscription?: { entity?: { id?: string; notes?: { user_id?: string; plan?: string } } };
      payment?: {
        entity?: {
          id?: string;
          error_reason?: string;
          error_description?: string;
          notes?: { user_id?: string };
        };
      };
    };
  };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = event.id;
  if (!eventId) {
    // Razorpay always sends event.id — its absence indicates a malformed or
    // forged payload. Reject with 400 so Razorpay doesn't retry.
    captureAlert(
      "Razorpay webhook: missing event.id",
      { route: "billing/webhook", eventType: event.event },
      "warning"
    );
    return NextResponse.json({ error: "Missing event.id" }, { status: 400 });
  }

  const payload = event.payload;
  const subEntity = payload?.subscription?.entity;
  const payEntity = payload?.payment?.entity;
  const userIdFromNotes =
    subEntity?.notes?.user_id ?? payEntity?.notes?.user_id ?? null;
  const planFromNotes = subEntity?.notes?.plan ?? null;

  // ── 3. V6+V7 — Atomic idempotency claim + audit row ──
  // If tryRecordBillingEvent returns false, this event was already processed
  // on an earlier delivery. Return 200 immediately so Razorpay stops retrying,
  // but do NOT re-run the handler (would double-count analytics, resend
  // welcome emails, etc.).
  let isFirstDelivery: boolean;
  try {
    isFirstDelivery = await tryRecordBillingEvent({
      eventId,
      eventType: event.event,
      subscriptionId: subEntity?.id ?? null,
      paymentId: payEntity?.id ?? null,
      userId: userIdFromNotes,
      plan: planFromNotes,
      signatureValid: true,
      rawPayload: event,
    });
  } catch (err) {
    // If the audit insert fails (DB down, etc.) we prefer to fall through and
    // still process the webhook rather than reject and force Razorpay retries.
    // Log so ops can investigate the DB.
    captureError(err, { route: "billing/webhook", stage: "audit_insert", eventId });
    isFirstDelivery = true;
  }

  if (!isFirstDelivery) {
    return NextResponse.json({ status: "ok", duplicate: true });
  }

  // ── 4. Dispatch (only on first delivery) ──
  let result = "noop";
  try {
    switch (event.event) {
      case "subscription.cancelled":
      case "subscription.expired": {
        const userId = subEntity?.notes?.user_id;
        if (userId) {
          const user = await getUserById(userId);
          if (user) {
            await updateUserPlan(userId, {
              plan: "free",
              dm_limit: PLANS.free.dm_limit,
              subscription_status:
                event.event === "subscription.cancelled" ? "cancelled" : "expired",
              razorpay_subscription_id: user.razorpay_subscription_id,
            });
            result = event.event === "subscription.cancelled" ? "cancelled" : "expired";
          }
        }
        break;
      }
      case "subscription.activated":
      case "subscription.charged": {
        const userId = subEntity?.notes?.user_id;
        // Bug fix 2026-09-09: previously we set `plan: user.plan`, which
        // for a first-time subscriber is 'free' — so subscription_status
        // flipped to 'active' but the plan never upgraded. Users were
        // billed on Razorpay but the app kept them on the free tier.
        // Now: read plan from the subscription's notes.plan (set at
        // creation time in /api/billing/checkout) and look up the
        // matching dm_limit from PLANS. Fall back to the existing user
        // values only if notes.plan is missing / not a real plan.
        const notesPlan = subEntity?.notes?.plan as PlanType | undefined;
        if (userId) {
          const user = await getUserById(userId);
          if (user) {
            const planConfig =
              notesPlan && PLANS[notesPlan] ? PLANS[notesPlan] : undefined;
            if (!planConfig) {
              captureAlert(
                "Razorpay webhook: unknown plan in notes",
                {
                  route: "billing/webhook",
                  userId,
                  notesPlan: String(notesPlan ?? "MISSING"),
                  event: event.event,
                },
                "warning"
              );
            }
            const targetPlan = planConfig ? notesPlan! : user.plan;
            const targetLimit = planConfig ? planConfig.dm_limit : user.dm_limit;
            await updateUserPlan(userId, {
              plan: targetPlan,
              dm_limit: targetLimit,
              subscription_status: "active",
              razorpay_subscription_id: subEntity?.id,
            });
            result = planConfig
              ? user.plan === targetPlan
                ? `active_${targetPlan}`
                : `upgraded_${user.plan}_to_${targetPlan}`
              : `active_fallback_${user.plan}`;
          }
        }
        break;
      }
      // V12.1 — Card declined / payment failure. We *never* upgrade the user
      // here; we just surface a warning so ops can investigate patterns
      // (bad BIN, high decline rate) in Sentry.
      case "payment.failed": {
        const paymentId = payEntity?.id ?? "";
        const errorReason =
          payEntity?.error_reason ?? payEntity?.error_description ?? "unknown";
        const userIdNote = payEntity?.notes?.user_id ?? "";
        captureAlert(
          "Razorpay payment failed",
          {
            route: "billing/webhook",
            paymentId,
            errorReason,
            userIdNote,
          },
          "warning"
        );
        result = `payment_failed:${errorReason}`;
        break;
      }
      default:
        result = `unhandled:${event.event}`;
    }

    // Best-effort — audit finalize should never fail the webhook response.
    finalizeBillingEvent(eventId, result).catch((err) =>
      captureError(err, { route: "billing/webhook", stage: "audit_finalize", eventId })
    );

    return NextResponse.json({ status: "ok", result });
  } catch (error) {
    captureError(error, { route: "billing/webhook", eventId, eventType: event.event });
    const msg = error instanceof Error ? error.message : String(error);
    finalizeBillingEvent(eventId, `error:${msg.slice(0, 200)}`).catch(() => {});
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
