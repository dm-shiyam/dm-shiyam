export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db";

// GET /api/billing/status
//
// Lightweight read of the current user's billing state for the dashboard
// header. Returns just what the UI needs to decide whether to show the
// "Cancel plan" button vs the "Cancels at period end" badge — not
// stuffed into the session so changes (e.g. after POST /cancel) are
// visible without a sign-out/in cycle.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByEmail(session.user.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Short private cache so a user bouncing between dashboard tabs
  // doesn't hammer the DB — but cancel actions still see fresh state
  // within 30s. User-scoped (private), never shared across users.
  return NextResponse.json(
    {
      plan: user.plan,
      subscription_status: user.subscription_status,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    }
  );
}
