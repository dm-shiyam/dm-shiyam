// A9.1 — Onboarding funnel metrics for the admin dashboard.
// Returns per-stage counts + median time-to-activation between milestones.
// Admin-only (same gate as /api/admin/stats).
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { isAdmin, getFunnelStats } from "@/lib/db";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const funnel = await getFunnelStats();
    return NextResponse.json(funnel);
  } catch (err) {
    console.error("[admin/funnel] Error:", err);
    return NextResponse.json({ error: "Failed to load funnel stats" }, { status: 500 });
  }
}
