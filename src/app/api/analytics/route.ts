import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsData } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const daysParam = searchParams.get("days");
  const raw = daysParam ? Number(daysParam) : NaN;
  const days = Number.isFinite(raw) ? Math.max(1, Math.min(365, Math.floor(raw))) : 30;

  try {
    const data = getAnalyticsData(days);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[analytics] Error:", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
