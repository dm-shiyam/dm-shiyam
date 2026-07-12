import { NextRequest, NextResponse } from "next/server";
import { getUserByResetToken, updatePassword, clearResetToken } from "@/lib/db";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  // Rate limit: 10 attempts per IP per 15 min to prevent token brute-force
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = rateLimit(`reset-password:${clientIp}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Password policy: min 8 chars, must contain at least a letter and a digit
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: "Password must contain letters and numbers" }, { status: 400 });
  }

  const user = await getUserByResetToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  await updatePassword(user.id, hash);
  await clearResetToken(user.id);

  return NextResponse.json({ success: true });
}