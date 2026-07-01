import { NextResponse } from "next/server";
import { getWebhookHealth } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const health = getWebhookHealth();

  if (!health) {
    return NextResponse.json({
      last_received_at: null,
      last_event_type: null,
      total_received: 0,
      status: "never_received",
    });
  }

  const lastReceivedAt = health.last_received_at ? new Date(health.last_received_at) : null;
  const minutesSinceLast = lastReceivedAt
    ? Math.floor((Date.now() - lastReceivedAt.getTime()) / 60000)
    : null;

  let status: "healthy" | "stale" | "never_received";
  if (!lastReceivedAt) {
    status = "never_received";
  } else if (minutesSinceLast !== null && minutesSinceLast > 60) {
    status = "stale";
  } else {
    status = "healthy";
  }

  return NextResponse.json({
    last_received_at: health.last_received_at,
    last_event_type: health.last_event_type,
    total_received: health.total_received,
    minutes_since_last: minutesSinceLast,
    status,
  });
}
