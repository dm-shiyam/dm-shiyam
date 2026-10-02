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
import { trackServerEvent } from "@/lib/analytics-server";
import {
  sendSubscriptionActivated,
  sendPaymentReceived,
  sendPaymentFailed,
  sendSubscriptionEnded,
  sendRefundInitiated,
} from "@/lib/email";

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
    event: string;
    payload: {
      subscription?: {
        entity?: {
          id?: string;
          // Unix seconds — the start of the next billing cycle. Present on
          // activated/charged events; what we show as "Next billing date"
          // in receipt emails.
          charge_at?: number;
          current_end?: number;
          notes?: {
            user_id?: string;
            plan?: string;
            cycle?: string;
            ga_client_id?: string;
          };
        };
      };
      payment?: {
        entity?: {
          id?: string;
          // Paise. Present on payment.* and refund.* events (the latter as
          // the amount of the *original* captured payment).
          amount?: number;
          error_reason?: string;
          error_description?: string;
          notes?: {
            user_id?: string;
            plan?: string;
            cycle?: string;
          };
        };
      };
      refund?: {
        entity?: {
          id?: string;
          amount?: number; // paise refunded (can be partial)
          payment_id?: string;
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

  // S5.6.5 fix: the event id is NOT in the JSON body (confirmed via a real
  // signature-valid payload — body only has entity/account_id/event/
  // contains/payload/created_at, no `id`). Razorpay sends it as the
  // `x-razorpay-event-id` header instead.
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!eventId) {
    captureAlert(
      "Razorpay webhook: missing x-razorpay-event-id header",
      { route: "billing/webhook", eventType: event.event },
      "warning"
    );
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  const payload = event.payload;
  const subEntity = payload?.subscription?.entity;
  const payEntity = payload?.payment?.entity;
  const refundEntity = payload?.refund?.entity;
  const userIdFromNotes =
    subEntity?.notes?.user_id ??
    payEntity?.notes?.user_id ??
    refundEntity?.notes?.user_id ??
    null;
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
      // S5.6 fix: Razorpay has no "subscription.expired" webhook event —
      // this case was dead code (see webhook Active Events dropdown, which
      // has no such option). The real event for a subscription lapsing
      // after it runs its total_count billing cycles without renewing is
      // "subscription.completed". Kept the `subscription_status: "expired"`
      // DB value as-is (schema.sql's CHECK constraint still allows it) —
      // only the triggering event name was wrong.
      case "subscription.completed": {
        const userId = subEntity?.notes?.user_id;
        if (userId) {
          const user = await getUserById(userId);
          if (user) {
            // Capture the plan the user is losing *before* we downgrade so
            // the farewell email can show "Previous plan: Pro" instead of
            // the already-overwritten "Free".
            const previousPlan = user.plan;
            await updateUserPlan(userId, {
              plan: "free",
              dm_limit: PLANS.free.dm_limit,
              subscription_status:
                event.event === "subscription.cancelled" ? "cancelled" : "expired",
              razorpay_subscription_id: user.razorpay_subscription_id,
            });
            result = event.event === "subscription.cancelled" ? "cancelled" : "expired";

            // Fire-and-forget — don't fail the webhook if email fails.
            sendSubscriptionEnded({
              to: user.email,
              name: user.name,
              previousPlan,
            }).catch((err) =>
              captureError(err, {
                route: "billing/webhook",
                stage: "email_ended",
                userId,
              })
            );
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
        const gaClientId = subEntity?.notes?.ga_client_id;
        if (userId) {
          const user = await getUserById(userId);
          if (user) {
            // Captured before updateUserPlan overwrites it — distinguishes a
            // genuine new subscription (S5.6.5 conversion) from a monthly
            // renewal charge, which dispatches through this same case but
            // must NOT re-fire subscription_started.
            const wasActive = user.subscription_status === "active";
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

            // S5.6.5 — server-side GA4 conversion, fired once per subscriber
            // on the payment-confirmed transition (not the checkout click,
            // not renewals). Falls back to a synthetic client_id when the
            // browser's wasn't captured, so the conversion still counts
            // toward revenue/volume even without campaign attribution.
            if (planConfig && !wasActive) {
              // Amount attributed to the conversion matches what the user
              // was actually charged for this billing cycle. Yearly ==
              // price_yearly (upfront 12-month charge, "2 months free"),
              // monthly == price_monthly. Falls back to monthly if the
              // notes are missing a cycle (older subscriptions).
              const cycle = subEntity?.notes?.cycle === "yearly" ? "yearly" : "monthly";
              const amount =
                cycle === "yearly" && planConfig.price_yearly
                  ? planConfig.price_yearly
                  : planConfig.price_monthly;
              await trackServerEvent(
                gaClientId || `srv.${userId}`,
                "subscription_started",
                { plan: targetPlan, cycle, amount, currency: "INR" }
              );
            }

            // S5.8.4 — Payment lifecycle emails.
            //   • First activation of a brand-new subscription → "welcome
            //     to Pro" email which doubles as the receipt for the
            //     activation charge (so we don't also send
            //     sendPaymentReceived for the same transaction).
            //   • Recurring renewal charge → sendPaymentReceived receipt.
            //   • `wasActive` is the cleanest signal: first charge flips
            //     subscription_status from 'none'/'cancelled' to 'active'
            //     for the first time, so wasActive === false means "this
            //     is the activation event". Guard on planConfig so we
            //     never email a user with an unknown/garbled plan.
            if (planConfig) {
              const cycle = subEntity?.notes?.cycle === "yearly" ? "yearly" : "monthly";
              const chargedAmount =
                payEntity?.amount ??
                (cycle === "yearly" && planConfig.price_yearly
                  ? planConfig.price_yearly
                  : planConfig.price_monthly);
              const nextChargeAt = subEntity?.charge_at ?? null;
              const emailPromise = !wasActive
                ? sendSubscriptionActivated({
                    to: user.email,
                    name: user.name,
                    plan: targetPlan,
                    cycle,
                    amountPaise: chargedAmount,
                    nextChargeAtUnix: nextChargeAt,
                  })
                : sendPaymentReceived({
                    to: user.email,
                    name: user.name,
                    plan: targetPlan,
                    cycle,
                    amountPaise: chargedAmount,
                    paymentId: payEntity?.id ?? "",
                    nextChargeAtUnix: nextChargeAt,
                  });
              emailPromise.catch((err) =>
                captureError(err, {
                  route: "billing/webhook",
                  stage: wasActive ? "email_charged" : "email_activated",
                  userId,
                })
              );
            }
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

        // Notify the user so they know a charge didn't go through
        // (and that we'll keep retrying). Needs the user_id in the
        // original payment's notes — set at checkout time.
        if (userIdNote) {
          const user = await getUserById(userIdNote);
          if (user) {
            sendPaymentFailed({
              to: user.email,
              name: user.name,
              plan: user.plan,
              errorReason:
                payEntity?.error_description ?? errorReason,
            }).catch((err) =>
              captureError(err, {
                route: "billing/webhook",
                stage: "email_payment_failed",
                userId: userIdNote,
              })
            );
          }
        }
        break;
      }
      // S5.8.4 — Refund initiated. Razorpay fires `refund.created` the
      // instant a refund is kicked off; actual settlement is signalled
      // later by `refund.processed`. We email on `refund.created` because
      // the user's main anxiety is "did my refund actually start" — the
      // "money arrived" part they'll see in their bank/UPI app.
      case "refund.created": {
        const refundId = refundEntity?.id ?? "";
        const paymentId =
          refundEntity?.payment_id ?? payEntity?.id ?? "";
        const amount = refundEntity?.amount ?? 0;
        // Prefer refund.notes.user_id (set manually by ops when they issue
        // the refund in the dashboard), fall back to the original payment's
        // notes — we always stuff user_id in there at checkout.
        const userId =
          refundEntity?.notes?.user_id ?? payEntity?.notes?.user_id ?? "";

        if (userId && amount > 0) {
          const user = await getUserById(userId);
          if (user) {
            sendRefundInitiated({
              to: user.email,
              name: user.name,
              amountPaise: amount,
              paymentId,
              refundId,
            }).catch((err) =>
              captureError(err, {
                route: "billing/webhook",
                stage: "email_refund",
                userId,
                refundId,
              })
            );
            result = `refund_initiated:${amount}paise`;
          } else {
            captureAlert(
              "Razorpay refund.created: user not found",
              { route: "billing/webhook", userId, refundId },
              "warning"
            );
            result = `refund_initiated_no_user`;
          }
        } else {
          captureAlert(
            "Razorpay refund.created: missing user_id or amount",
            {
              route: "billing/webhook",
              refundId,
              paymentId,
              amount,
              hasUserId: Boolean(userId),
            },
            "warning"
          );
          result = `refund_initiated_incomplete`;
        }
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
