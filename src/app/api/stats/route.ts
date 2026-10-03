// ===== src/app/api/stats/route.ts =====
import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const stats = await getDashboardStats(userId);
    // Short private cache — the dashboard polls every 30s anyway, so
    // allowing the browser to reuse the response for 15s between tab
    // flicks / quick refreshes saves a DB round-trip without ever
    // showing stale counts for more than one poll cycle.
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}