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

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan, cycle: cycleRaw } =
      await request.json();

    // Cycle is accepted for observability / consistency with checkout —
    // the source of truth for what was actually billed lives in the
    // Razorpay subscription's notes, echoed by the webhook. Verify only
    // marks the plan active and doesn't need to gate on cycle.
    void (cycleRaw === "yearly" ? "yearly" : "monthly");

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature || !plan) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest("hex");

    // Use timing-safe comparison to defeat timing-side-channel signature guessing
    const receivedSig = typeof razorpay_signature === "string" ? razorpay_signature : "";
    const sigValid =
      receivedSig.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSignature));

    if (!sigValid) {
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