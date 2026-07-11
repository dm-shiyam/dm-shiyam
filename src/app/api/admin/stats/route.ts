// ===== src/app/api/admin/stats/route.ts =====
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { isAdmin, getAdminStats } from "@/lib/db";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const stats = await getAdminStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[admin/stats] Error:", err);
    return NextResponse.json({ error: "Failed to load admin stats" }, { status: 500 });
  }
}