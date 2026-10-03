import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, setResetToken } from "@/lib/db";
import crypto from "crypto";
import { escapeHtml } from "@/lib/html";
import { rateLimit } from "@/lib/rate-limiter";
import { sendPasswordResetEmail } from "@/lib/email";

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

  // Routed through the shared email helper so the branded shell (logo
  // chip, header, footer) is applied — fixes a bug where the reset email
  // was the only template without the DM Shiyam logo because it bypassed
  // sendEmail() with its own Resend instance.
  await sendPasswordResetEmail({ to: email, name: safeName, resetUrl });

  return NextResponse.json({ success: true });
}
