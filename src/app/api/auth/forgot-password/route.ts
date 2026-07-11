import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, setResetToken } from "@/lib/db";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const user = await getUserByEmail(email);

  // Always return success — don't leak whether email exists
  if (!user) {
    return NextResponse.json({ success: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  await setResetToken(email, token, expiresAt);

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  try {
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || "onboarding@resend.dev",
      to: email,
      subject: "Reset your DM Shiyam password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #111;">Reset your password</h2>
          <p>Hi ${user.name},</p>
          <p>We received a request to reset your DM Shiyam password. Click the button below to choose a new one.</p>
          <a href="${resetUrl}"
             style="display: inline-block; margin: 24px 0; padding: 12px 24px;
                    background: #6366f1; color: #fff; border-radius: 6px;
                    text-decoration: none; font-weight: 600;">
            Reset Password
          </a>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request a reset, you can ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">DM Shiyam · dmshiyamofficial@gmail.com</p>
        </div>
      `,
    });

    console.log("[resend] Result:", result);
  } catch (err) {
    console.error("[resend] Email send failed:", err);
    console.error("[forgot-password] Email send failed:", err);
    // Don't expose email errors to the client
  }

  return NextResponse.json({ success: true });
}