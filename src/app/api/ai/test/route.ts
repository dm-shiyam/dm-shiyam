import { NextRequest, NextResponse } from "next/server";
import { generateAiReply, generateAiCommentReply } from "@/lib/openai";
import { getSessionUserId } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      commentText,
      commenterUsername,
      staticDmTemplate,
      customSystemPrompt,
      mode = "dm",
    } = body;

    if (!commentText || !commenterUsername) {
      return NextResponse.json(
        { error: "commentText and commenterUsername are required" },
        { status: 400 }
      );
    }

    if (mode === "comment_reply") {
      const result = await generateAiCommentReply({
        commentText,
        commenterUsername,
        customSystemPrompt,
      });
      return NextResponse.json(result);
    }

    if (!staticDmTemplate) {
      return NextResponse.json(
        { error: "staticDmTemplate is required for dm mode" },
        { status: 400 }
      );
    }

    const result = await generateAiReply({
      commentText,
      commenterUsername,
      staticDmTemplate,
      customSystemPrompt,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI test error:", error);
    return NextResponse.json({ error: "AI test failed" }, { status: 500 });
  }
}
