// ===== src/app/api/onboarding/route.ts =====
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { markOnboardingSeen } from "@/lib/db";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await markOnboardingSeen(userId);
  return NextResponse.json({ success: true });
}