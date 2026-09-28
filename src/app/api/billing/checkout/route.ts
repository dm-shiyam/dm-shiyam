export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db";
import Razorpay from "razorpay";
import { PLANS } from "@/lib/plans";
import type { PlanType, BillingCycle } from "@/types";
import { rateLimit } from "@/lib/rate-limiter";

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

// Razorpay Plan IDs — one per (plan, cycle) pair. Yearly plans must be
// created as separate Plan objects in the Razorpay dashboard with
// period=yearly, interval=1. Monthly plans use period=monthly, interval=1.
// If a yearly env var isn't set, /pricing yearly checkout for that tier
// will 500 with "Plan not configured in Razorpay" — safer than silently
// billing the monthly price.
const RAZORPAY_PLAN_IDS: Record<BillingCycle, Partial<Record<PlanType, string>>> = {
  monthly: {
    starter: process.env.RAZORPAY_PLAN_STARTER || "",
    pro: process.env.RAZORPAY_PLAN_PRO || "",
    business: process.env.RAZORPAY_PLAN_BUSINESS || "",
    agency: process.env.RAZORPAY_PLAN_AGENCY || "",
  },
  yearly: {
    starter: process.env.RAZORPAY_PLAN_STARTER_YEARLY || "",
    pro: process.env.RAZORPAY_PLAN_PRO_YEARLY || "",
    business: process.env.RAZORPAY_PLAN_BUSINESS_YEARLY || "",
    agency: process.env.RAZORPAY_PLAN_AGENCY_YEARLY || "",
  },
};

// Razorpay's `total_count` is the number of billing cycles the subscription
// runs before completing. Monthly: 12 = ~1 year cap. Yearly: 3 = ~3 year cap
// (each cycle already covers 12 months, so 3 gives a comfortable renewal
// horizon before the subscription completes and the user re-subscribes).
const TOTAL_COUNT_BY_CYCLE: Record<BillingCycle, number> = {
  monthly: 12,
  yearly: 3,
};

function isPlaceholderValue(value?: string) {
  return !value || value.includes("xxx") || value.includes("YOUR_") || value.includes("replace") || value.includes("test_plan");
}

// Only fall back to mock checkout in dev when the SPECIFIC plan id being
// used is a placeholder (or the shared Razorpay keys are). This lets
// yearly env vars stay unset locally without breaking monthly checkout.
function shouldUseMockCheckout(razorpayPlanId: string | undefined) {
  return (
    process.env.NODE_ENV !== "production" &&
    (isPlaceholderValue(process.env.RAZORPAY_KEY_ID) ||
      isPlaceholderValue(process.env.RAZORPAY_KEY_SECRET) ||
      isPlaceholderValue(razorpayPlanId))
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

    const { plan, ga_client_id, cycle: cycleRaw } = await request.json();

    // Validate billing cycle. Defaults to "monthly" for backward compat
    // with existing callers (e.g. old links without ?cycle=). Free tier
    // rejected below regardless of cycle.
    const cycle: BillingCycle =
      cycleRaw === "yearly" ? "yearly" : "monthly";

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

    // Guard: yearly checkout only for tiers that have a yearly price
    // configured. Should be impossible from the UI, but the API is
    // publicly reachable so we validate defensively.
    if (cycle === "yearly" && !PLANS[plan as PlanType].price_yearly) {
      return NextResponse.json(
        { error: "Yearly billing is not available for this plan" },
        { status: 400 }
      );
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const razorpayPlanId = RAZORPAY_PLAN_IDS[cycle][plan as PlanType];

    if (shouldUseMockCheckout(razorpayPlanId)) {
      return NextResponse.json({
        subscription_id: `mock-${plan}-${cycle}-${user.id}`,
        razorpay_key: process.env.RAZORPAY_KEY_ID || "mock",
        short_url: "https://razorpay.com/payments-onboard-1/",
        shortUrl: "https://razorpay.com/payments-onboard-1/",
        cycle,
        mock: true,
      });
    }

    if (!razorpayPlanId) {
      return NextResponse.json({ error: "Plan not configured in Razorpay" }, { status: 500 });
    }

    const razorpay = getRazorpay();
    const subscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      total_count: TOTAL_COUNT_BY_CYCLE[cycle],
      // `cycle` propagates through Razorpay's notes so the webhook — which
      // has no request context — can attribute the correct amount to the
      // GA4 subscription_started conversion (monthly vs yearly revenue).
      notes: {
        user_id: user.id,
        plan,
        cycle,
        ...(gaClientId ? { ga_client_id: gaClientId } : {}),
      },
    });

    return NextResponse.json({
      subscription_id: subscription.id,
      razorpay_key: process.env.RAZORPAY_KEY_ID,
      short_url: subscription.short_url,
      shortUrl: subscription.short_url,
      cycle,
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