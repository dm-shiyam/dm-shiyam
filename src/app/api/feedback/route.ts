// src/app/api/feedback/route.ts — A14: in-app feedback intake
// Auth required. Persists to DB + emails support (fire-and-forget).

import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { createFeedback, getUserById, type FeedbackRating } from "@/lib/db";
import { sendFeedbackToSupport } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Simple abuse guard: 10 submissions / user / hour
    const rl = rateLimit(`feedback:${userId}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many feedback submissions, try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const rating = body?.rating as FeedbackRating | undefined;
    const comment = typeof body?.comment === "string" ? body.comment.slice(0, 2000) : null;
    const source = typeof body?.source === "string" ? body.source.slice(0, 60) : "first_dm_toast";

    if (rating !== "up" && rating !== "down") {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }

    const row = await createFeedback({ userId, rating, comment, source });

    // Fire-and-forget email so slow SMTP never blocks the toast UX.
    (async () => {
      try {
        const user = await getUserById(userId);
        await sendFeedbackToSupport({
          rating,
          comment,
          userEmail: user?.email ?? null,
          userName: user?.name ?? null,
          source,
        });
      } catch (err) {
        console.error("[feedback] support email failed:", err);
      }
    })();

    return NextResponse.json({ success: true, id: row.id });
  } catch (err) {
    console.error("[feedback] POST failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
