import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail, updateUserPlan } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import type { PlanType } from "@/types";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan } =
      await request.json();

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature || !plan) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const planConfig = PLANS[plan as PlanType];
    if (!planConfig) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const updated = await updateUserPlan(user.id, {
      plan,
      dm_limit: planConfig.dm_limit,
      razorpay_customer_id: razorpay_payment_id,
      razorpay_subscription_id,
      subscription_status: "active",
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}