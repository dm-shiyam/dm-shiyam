import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, setResetToken } from "@/lib/db";
import { Resend } from "resend";
import crypto from "crypto";
import { escapeHtml } from "@/lib/html";
import { rateLimit } from "@/lib/rate-limiter";

// Lazy-init Resend so a missing key doesn't crash the route at import time
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 requests per IP per 15 minutes to prevent abuse & email enumeration
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = rateLimit(`forgot-password:${clientIp}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

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

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(user.name || "there");

  const resend = getResend();
  if (!resend) {
    console.warn("[forgot-password] RESEND_API_KEY not set — skipping email send");
    return NextResponse.json({ success: true });
  }

  try {
    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || "onboarding@resend.dev",
      to: email,
      subject: "Reset your DM Shiyam password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #111;">Reset your password</h2>
          <p>Hi ${safeName},</p>
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
    console.error("[forgot-password] Email send failed:", err);
    // Don't expose email errors to the client
  }

  return NextResponse.json({ success: true });
}