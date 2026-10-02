export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail, updateUserPlan } from "@/lib/db";
import Razorpay from "razorpay";
import { rateLimit } from "@/lib/rate-limiter";
import { captureError } from "@/lib/monitoring";

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

    if (!user.razorpay_subscription_id) {
      // Edge case: a user whose plan was granted manually (e.g. comp'd by
      // support) has no Razorpay subscription to cancel. Just mark them
      // cancelled so the webhook never flips them back.
      await updateUserPlan(user.id, {
        plan: user.plan,
        dm_limit: user.dm_limit,
        subscription_status: "cancelled",
      });
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
    await razorpay.subscriptions.cancel(user.razorpay_subscription_id, true);

    await updateUserPlan(user.id, {
      plan: user.plan,
      dm_limit: user.dm_limit,
      subscription_status: "cancelled",
      razorpay_subscription_id: user.razorpay_subscription_id,
    });

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
