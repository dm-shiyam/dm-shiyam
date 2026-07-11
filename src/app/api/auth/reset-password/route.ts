import { NextRequest, NextResponse } from "next/server";
import { getUserByResetToken, updatePassword, clearResetToken } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password too short" }, { status: 400 });

  const user = await getUserByResetToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  await updatePassword(user.id, hash);
  await clearResetToken(user.id);

  return NextResponse.json({ success: true });
}