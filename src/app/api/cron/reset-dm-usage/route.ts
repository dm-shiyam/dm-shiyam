// api/cron/reset-dm-usage/route.ts
// Task #6: Monthly DM usage reset
// Called by cron job on the 1st of each month (or via Vercel Cron)
// Protected by CRON_SECRET to prevent unauthorized access

import { NextRequest, NextResponse } from "next/server";
import { resetMonthlyDmUsage } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(req: NextRequest) {
  // Verify the cron secret
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "") || "";

  if (!CRON_SECRET) {
    console.error("[cron] CRON_SECRET not configured — rejecting request");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (providedSecret !== CRON_SECRET) {
    console.error("[cron] Invalid cron secret — rejecting request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    resetMonthlyDmUsage();
    console.log("[cron] Monthly DM usage reset completed successfully");
    return NextResponse.json({ success: true, message: "Monthly DM usage reset completed", resetAt: new Date().toISOString() });
  } catch (err) {
    console.error("[cron] Failed to reset DM usage:", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}

// Also support GET for Vercel Cron (which sends GET requests)
export async function GET(req: NextRequest) {
  return POST(req);
}
