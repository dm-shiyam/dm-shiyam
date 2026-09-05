import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUserPlan } from "@/lib/db";
import crypto from "crypto";
import { captureError, captureAlert } from "@/lib/monitoring";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

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

    const event = JSON.parse(body);
    const payload = event.payload;

    switch (event.event) {
      case "subscription.cancelled":
      case "subscription.expired": {
        const userId = payload?.subscription?.entity?.notes?.user_id;
        if (userId) {
          const user = await getUserById(userId);
          if (user) {
            await updateUserPlan(userId, {
              plan: "free",
              dm_limit: 100,
              subscription_status: event.event === "subscription.cancelled" ? "cancelled" : "expired",
              razorpay_subscription_id: user.razorpay_subscription_id,
            });
          }
        }
        break;
      }
      case "subscription.activated":
      case "subscription.charged": {
        const userId = payload?.subscription?.entity?.notes?.user_id;
        if (userId) {
          const user = await getUserById(userId);
          if (user) {
            await updateUserPlan(userId, {
              plan: user.plan,
              dm_limit: user.dm_limit,
              subscription_status: "active",
              razorpay_subscription_id: payload?.subscription?.entity?.id,
            });
          }
        }
        break;
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    captureError(error, { route: "billing/webhook" });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}