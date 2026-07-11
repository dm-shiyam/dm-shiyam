import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsData } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const raw = Number(new URL(req.url).searchParams.get("days"));
    const days = Number.isFinite(raw) ? Math.max(1, Math.min(365, Math.floor(raw))) : 30;

    const data = await getAnalyticsData(days, userId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[analytics] Error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : "",
      },
      { status: 500 }
    );
  }
}