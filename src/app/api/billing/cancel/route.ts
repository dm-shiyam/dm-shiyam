export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail, updateUserPlan } from "@/lib/db";
import Razorpay from "razorpay";
import { rateLimit } from "@/lib/rate-limiter";
import { captureError } from "@/lib/monitoring";
import { sendSubscriptionCancellationScheduled } from "@/lib/email";

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

// POST /api/billing/cancel
//
// Cancels the authenticated user's active Razorpay subscription at the end
// of the current billing cycle. The user keeps full access to their paid
// plan until the cycle completes — at which point Razorpay fires
// `subscription.cancelled` and the webhook (billing/webhook) flips them
// down to the free tier.
//
// We don't downgrade the user's `plan` here (they still get what they
// paid for); we only mark `subscription_status = "cancelled"` so the UI
// can show "Cancels on <date>" and we stop prompting for renewal.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 5 cancel attempts per 10 minutes per user. Cheap defense
    // against a compromised session or UI bug repeatedly hitting Razorpay.
    const rl = rateLimit(`cancel:${session.user.email.toLowerCase()}`, 5, 10 * 60 * 1000);
    if (!rl.allowed) {
      const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many cancel attempts. Try again in ${retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.plan === "free") {
      return NextResponse.json(
        { error: "You're on the free plan — nothing to cancel." },
        { status: 400 }
      );
    }

    if (user.subscription_status === "cancelled") {
      return NextResponse.json(
        { error: "Your subscription is already scheduled to cancel at the end of this billing cycle." },
        { status: 400 }
      );
    }

    // Helper so every successful-cancel path sends the confirmation email
    // (previously only the Razorpay-happy path did — users whose IDs went
    // through the fallback branches got a success toast but no email).
    //
    // IMPORTANT: this is awaited before responding, not fire-and-forget.
    // On Vercel serverless, as soon as the HTTP response is sent, the
    // function instance can be terminated and pending promises (including
    // Resend's fetch) are dropped mid-flight — confirmed 2026-10-02.
    // Blocking adds ~400ms which is well inside users' click→toast
    // tolerance, and the catch keeps a Resend outage from 500ing a cancel
    // that otherwise succeeded.
    const emailCancelScheduled = async (cycleEndUnix: number | null) => {
      try {
        await sendSubscriptionCancellationScheduled({
          to: user.email,
          name: user.name,
          plan: user.plan,
          cycleEndUnix,
        });
      } catch (err) {
        captureError(err, {
          route: "billing/cancel",
          stage: "email_cancel_scheduled",
          userId: user.id,
        });
      }
    };

    if (!user.razorpay_subscription_id) {
      // Edge case: a user whose plan was granted manually (e.g. comp'd by
      // support) has no Razorpay subscription to cancel. Just mark them
      // cancelled so the webhook never flips them back.
      await updateUserPlan(user.id, {
        plan: user.plan,
        dm_limit: user.dm_limit,
        subscription_status: "cancelled",
      });
      await emailCancelScheduled(null);
      return NextResponse.json({
        status: "cancelled",
        message: "Subscription cancelled.",
      });
    }

    // Dev / mock-checkout path: subscriptions created via the mock flow
    // (see billing/checkout) have IDs like "mock-pro-monthly-<userId>" and
    // don't exist in Razorpay. Short-circuit so local dev still works.
    if (user.razorpay_subscription_id.startsWith("mock-")) {
      await updateUserPlan(user.id, {
        plan: user.plan,
        dm_limit: user.dm_limit,
        subscription_status: "cancelled",
        razorpay_subscription_id: user.razorpay_subscription_id,
      });
      await emailCancelScheduled(null);
      return NextResponse.json({
        status: "cancelled",
        mock: true,
        message: "Subscription cancelled (mock).",
      });
    }

    // cancelAtCycleEnd=true: Razorpay keeps the sub `active` until the
    // current period ends, charges nothing further, then fires
    // `subscription.cancelled`. This is the "cancel anytime, keep what
    // you paid for" UX we promise in the FAQ.
    const razorpay = getRazorpay();
    // Razorpay returns the updated subscription object — we lift
    // current_end off it to show the user when their access actually
    // ends in the confirmation email ("access until <date>").
    let cycleEndUnix: number | null = null;
    try {
      const updated = (await razorpay.subscriptions.cancel(
        user.razorpay_subscription_id,
        true
      )) as { current_end?: number | null };
      cycleEndUnix = updated.current_end ?? null;
    } catch (rzpErr: unknown) {
      // Razorpay surfaces its API errors as `{ statusCode, error: { code, description, ... } }`.
      // Reach in defensively — the SDK's TS types don't expose it.
      const e = rzpErr as {
        statusCode?: number;
        error?: { code?: string; description?: string };
      };
      const rzpDescription = e?.error?.description;
      const rzpCode = e?.error?.code;
      const statusCode = e?.statusCode;

      captureError(rzpErr, {
        route: "billing/cancel",
        stage: "razorpay_cancel",
        userId: user.id,
        subscriptionId: user.razorpay_subscription_id,
        rzpCode,
        rzpDescription,
        statusCode,
      });

      // Cases where there's nothing to cancel on Razorpay's side — the
      // right move is to sync our DB and tell the user they're cancelled:
      //   • already cancelled / completed (webhook not synced yet, or
      //     support cancelled it manually in the dashboard)
      //   • id invalid / not found — the stored id is stale (e.g. test-mode
      //     subscription recorded against a live-mode account, or a plan
      //     granted manually without a real sub). No active billing to
      //     stop; silently sync and move on.
      const desc = rzpDescription?.toLowerCase() ?? "";
      const nothingToCancel =
        statusCode === 400 &&
        (desc.includes("cancelled") ||
          desc.includes("completed") ||
          desc.includes("invalid") ||
          desc.includes("not be found") ||
          desc.includes("not found"));

      if (nothingToCancel) {
        await updateUserPlan(user.id, {
          plan: user.plan,
          dm_limit: user.dm_limit,
          subscription_status: "cancelled",
          razorpay_subscription_id: user.razorpay_subscription_id,
        });
        await emailCancelScheduled(null);
        return NextResponse.json({
          status: "cancelled",
          message: "Subscription cancelled.",
        });
      }

      return NextResponse.json(
        {
          error: rzpDescription
            ? `Razorpay: ${rzpDescription}`
            : "Failed to cancel subscription with Razorpay. Please try again or email dmshiyamofficial@gmail.com.",
          code: rzpCode,
        },
        { status: 502 }
      );
    }

    await updateUserPlan(user.id, {
      plan: user.plan,
      dm_limit: user.dm_limit,
      subscription_status: "cancelled",
      razorpay_subscription_id: user.razorpay_subscription_id,
    });

    // Fire-and-forget — a slow email provider shouldn't delay the
    // success toast the user is waiting on. Email failure is already
    // captured + we still have the final "ended" email from the webhook
    // when Razorpay actually cancels at period end.
    await emailCancelScheduled(cycleEndUnix);

    return NextResponse.json({
      status: "cancelled",
      message:
        "Your subscription will cancel at the end of the current billing cycle. You'll keep full access until then.",
    });
  } catch (error) {
    captureError(error, { route: "billing/cancel" });
    return NextResponse.json(
      { error: "Failed to cancel subscription. Please try again or email dmshiyamofficial@gmail.com." },
      { status: 500 }
    );
  }
}
