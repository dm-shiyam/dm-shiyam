// ===== src/app/api/auth/forgot-password/route.ts =====
import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, setResetToken } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const user = await getUserByEmail(email);

  if (!user) {
    return NextResponse.json({ success: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await setResetToken(email, token, expiresAt);

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  console.log(`[DEV] Password reset link for ${email}: ${resetUrl}`);

  return NextResponse.json({ success: true });
}