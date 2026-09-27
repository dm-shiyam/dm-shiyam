export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db";
import Razorpay from "razorpay";
import { PLANS } from "@/lib/plans";
import type { PlanType } from "@/types";
import { rateLimit } from "@/lib/rate-limiter";

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

const RAZORPAY_PLAN_IDS: Partial<Record<PlanType, string>> = {
  starter: process.env.RAZORPAY_PLAN_STARTER || "",
  pro: process.env.RAZORPAY_PLAN_PRO || "",
  business: process.env.RAZORPAY_PLAN_BUSINESS || "",
  agency: process.env.RAZORPAY_PLAN_AGENCY || "",
};

function isPlaceholderValue(value?: string) {
  return !value || value.includes("xxx") || value.includes("YOUR_") || value.includes("replace") || value.includes("test_plan");
}

function shouldUseMockCheckout() {
  return (
    process.env.NODE_ENV !== "production" &&
    (isPlaceholderValue(process.env.RAZORPAY_KEY_ID) ||
      isPlaceholderValue(process.env.RAZORPAY_KEY_SECRET) ||
      isPlaceholderValue(process.env.RAZORPAY_PLAN_STARTER) ||
      isPlaceholderValue(process.env.RAZORPAY_PLAN_PRO) ||
      isPlaceholderValue(process.env.RAZORPAY_PLAN_BUSINESS) ||
      isPlaceholderValue(process.env.RAZORPAY_PLAN_AGENCY))
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // V8 — Rate limit per user: 5 subscription-create attempts per 5 minutes.
    // Prevents rage-clicks generating orphan Razorpay subscriptions (each one
    // costs a webhook cycle to auto-expire) and blocks trivial abuse by a
    // compromised account.
    const rl = rateLimit(`checkout:${session.user.email.toLowerCase()}`, 5, 5 * 60 * 1000);
    if (!rl.allowed) {
      const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Too many checkout attempts. Try again in ${retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const { plan, ga_client_id } = await request.json();

    // GA4 client_id captured client-side at click time (see PricingContent's
    // handleCheckout). Threaded through Razorpay's `notes` so the webhook —
    // which has no browser — can fire the server-side `subscription_started`
    // conversion attributed back to this session. Bound to a sane length;
    // this is client-supplied input reaching a third-party API field.
    const gaClientId =
      typeof ga_client_id === "string" && ga_client_id.length <= 64
        ? ga_client_id
        : undefined;

    if (!plan || !PLANS[plan as PlanType] || plan === "free") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (shouldUseMockCheckout()) {
      return NextResponse.json({
        subscription_id: `mock-${plan}-${user.id}`,
        razorpay_key: process.env.RAZORPAY_KEY_ID || "mock",
        short_url: "https://razorpay.com/payments-onboard-1/",
        shortUrl: "https://razorpay.com/payments-onboard-1/",
        mock: true,
      });
    }

    const razorpayPlanId = RAZORPAY_PLAN_IDS[plan as PlanType];
    if (!razorpayPlanId) {
      return NextResponse.json({ error: "Plan not configured in Razorpay" }, { status: 500 });
    }

    const razorpay = getRazorpay();
    const subscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      total_count: 12,
      notes: { user_id: user.id, plan, ...(gaClientId ? { ga_client_id: gaClientId } : {}) },
    });

    return NextResponse.json({
      subscription_id: subscription.id,
      razorpay_key: process.env.RAZORPAY_KEY_ID,
      short_url: subscription.short_url,
      shortUrl: subscription.short_url,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    // Surface the Razorpay error description to the client so support tickets
    // and dev-console clicks show the real reason (e.g. "The ID provided is
    // invalid or could not be found." when RAZORPAY_PLAN_* env vars point at
    // a stale/wrong plan). We deliberately DON'T leak stack traces or key IDs.
    const rzp = error as { error?: { description?: string; code?: string } };
    const rzpDesc = rzp?.error?.description;
    const rzpCode = rzp?.error?.code;
    const fallback =
      error instanceof Error ? error.message : "Failed to create subscription";
    return NextResponse.json(
      {
        error: rzpDesc || fallback,
        code: rzpCode || "checkout_failed",
      },
      { status: 500 }
    );
  }
}