import { NextRequest, NextResponse } from "next/server";
import { resetMonthlyDmUsage } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";

async function handler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const providedSecret = authHeader?.replace("Bearer ", "") || searchParams.get("secret") || "";

  if (!CRON_SECRET) {
    console.error("[cron] CRON_SECRET not configured — rejecting request");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }

  if (providedSecret !== CRON_SECRET) {
    console.error("[cron] Invalid cron secret — rejecting request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await resetMonthlyDmUsage();
    console.log("[cron] Monthly DM usage reset completed successfully");
    return NextResponse.json({
      success: true,
      message: "Monthly DM usage reset completed",
      resetAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron] Failed to reset DM usage:", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return handler(req); }
export async function GET(req: NextRequest) { return handler(req); }