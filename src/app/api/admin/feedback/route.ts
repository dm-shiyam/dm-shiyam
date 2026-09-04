// src/app/api/admin/feedback/route.ts — A14: list feedback for admin dashboard
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { isAdmin, listFeedback } from "@/lib/db";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rows = await listFeedback(200);
    return NextResponse.json({ feedback: rows });
  } catch (err) {
    console.error("[admin/feedback] Error:", err);
    return NextResponse.json({ error: "Failed to load feedback" }, { status: 500 });
  }
}
