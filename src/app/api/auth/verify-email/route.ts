import { NextRequest, NextResponse } from "next/server";
import { getUserByVerificationToken, verifyUserEmail } from "@/lib/db";

// GET because this is a link clicked from an email, not a form submission.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/verify-email-pending?error=missing`);
  }

  const user = await getUserByVerificationToken(token);
  if (!user) {
    // Token invalid, already used, or expired (24h window)
    return NextResponse.redirect(`${baseUrl}/verify-email-pending?error=invalid`);
  }

  await verifyUserEmail(user.id);

  return NextResponse.redirect(`${baseUrl}/dashboard?verified=1`);
}
