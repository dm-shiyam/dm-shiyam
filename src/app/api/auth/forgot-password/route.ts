import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, setResetToken } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const user = getUserByEmail(email);
  
  // Always return success even if user not found — don't leak whether email exists
  if (!user) {
    return NextResponse.json({ success: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  setResetToken(email, token, expiresAt);

  // TODO: Send email. For now, log the reset link (dev only)
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  console.log(`[DEV] Password reset link for ${email}: ${resetUrl}`);
  
  // In production, integrate with Resend/Nodemailer here:
  // await sendEmail({ to: email, subject: "Reset your DM Shiyam password", html: `...` })

  return NextResponse.json({ success: true });
}