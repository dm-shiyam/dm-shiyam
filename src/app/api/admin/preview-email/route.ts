export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { isAdmin } from "@/lib/db";
import {
  sendSubscriptionActivated,
  sendPaymentReceived,
  sendPaymentFailed,
  sendSubscriptionCancellationScheduled,
  sendSubscriptionEnded,
  sendRefundInitiated,
} from "@/lib/email";

// GET /api/admin/preview-email?type=<type>&to=<email>&plan=<plan>&cycle=<cycle>
//
// Admin-only. Sends the real transactional email template with sample data
// to the given address, so Ankit can proof the new payment-lifecycle
// emails in Gmail without burning real money on a Razorpay subscription.
//
// All six S5.8.4 templates are available via `type`:
//   activated | charged | failed | cancel_scheduled | ended | refund
//
// Sample values are static (plan=starter monthly ₹149, 30 days ahead for
// next billing) unless overridden via query params. The resulting email
// is indistinguishable from the real one in the inbox — same template
// code path, same Resend API call.
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "";
  const to = searchParams.get("to") ?? "";
  const plan = searchParams.get("plan") ?? "starter";
  const cycleRaw = searchParams.get("cycle") ?? "monthly";
  const cycle: "monthly" | "yearly" = cycleRaw === "yearly" ? "yearly" : "monthly";

  if (!to) {
    return NextResponse.json(
      {
        error: "Missing `to` query param",
        hint: "GET /api/admin/preview-email?type=activated&to=you@example.com",
        availableTypes: [
          "activated",
          "charged",
          "failed",
          "cancel_scheduled",
          "ended",
          "refund",
        ],
      },
      { status: 400 }
    );
  }

  // Static sample data. Chosen to match Starter monthly ₹149 so the
  // numbers in the email look exactly like a real activation.
  const name = "Ankit (preview)";
  const amountPaise = cycle === "yearly" ? 149000 : 14900;
  const nextChargeAtUnix =
    Math.floor(Date.now() / 1000) +
    (cycle === "yearly" ? 365 : 30) * 24 * 60 * 60;
  const samplePaymentId = "pay_PREVIEWSAMPLE123";
  const sampleRefundId = "rfnd_PREVIEWSAMPLE123";

  let result: { success: boolean; error?: string } | undefined;

  try {
    switch (type) {
      case "activated":
        result = await sendSubscriptionActivated({
          to, name, plan, cycle, amountPaise, nextChargeAtUnix,
        });
        break;
      case "charged":
        result = await sendPaymentReceived({
          to, name, plan, cycle, amountPaise,
          paymentId: samplePaymentId,
          nextChargeAtUnix,
        });
        break;
      case "failed":
        result = await sendPaymentFailed({
          to, name, plan,
          errorReason: "Card declined by issuing bank (preview sample)",
        });
        break;
      case "cancel_scheduled":
        result = await sendSubscriptionCancellationScheduled({
          to, name, plan, cycleEndUnix: nextChargeAtUnix,
        });
        break;
      case "ended":
        result = await sendSubscriptionEnded({
          to, name, previousPlan: plan,
        });
        break;
      case "refund":
        result = await sendRefundInitiated({
          to, name,
          amountPaise,
          paymentId: samplePaymentId,
          refundId: sampleRefundId,
        });
        break;
      default:
        return NextResponse.json(
          {
            error: `Unknown type "${type}"`,
            availableTypes: [
              "activated",
              "charged",
              "failed",
              "cancel_scheduled",
              "ended",
              "refund",
            ],
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      type,
      to,
      plan,
      cycle,
      sent: result?.success === true,
      error: result?.error,
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
