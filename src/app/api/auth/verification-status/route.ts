// src/app/api/auth/verification-status/route.ts
// Tiny status endpoint used by /verify-email-pending to poll for
// verification completion. When the user clicks the verification link
// (which opens in a new tab and updates email_verified_at in DB), the
// old "Check your inbox" tab has no way to know unless it asks. This
// endpoint returns the current DB-fresh state so the client can poll +
// auto-redirect once verified.
//
// Auth: requires session. Cheap: one indexed SELECT per call.
// Rate-limit: not needed — the polling client calls once per 3s at
// most, and only while the user is actively on the pending page.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json(
      { verified: false, authenticated: false },
      { status: 401 }
    );
  }
  const user = await getUserById(userId);
  return NextResponse.json({
    authenticated: true,
    verified: Boolean(user?.email_verified_at),
  });
}
