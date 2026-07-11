export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db";
import Razorpay from "razorpay";
import { PLANS } from "@/lib/plans";
import type { PlanType } from "@/types";

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await request.json();

    if (!plan || !PLANS[plan as PlanType] || plan === "free") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const razorpayPlanId = RAZORPAY_PLAN_IDS[plan as PlanType];
    if (!razorpayPlanId) {
      return NextResponse.json({ error: "Plan not configured in Razorpay" }, { status: 500 });
    }

    const razorpay = getRazorpay();
    const subscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      total_count: 12,
      notes: { user_id: user.id, plan },
    });

    return NextResponse.json({
      subscription_id: subscription.id,
      razorpay_key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}