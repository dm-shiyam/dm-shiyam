// app/api/webhook/instagram/route.ts
// Fixed version — DMs now send correctly

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendDM, sendPrivateReply, replyToComment, personalizeMessage } from "@/lib/instagram";
import {
  getActiveAutomations,
  logActivity,
  getUserById,
  incrementDmsUsed,
  hasDmBeenSent,
  recordSentDm,
  updateWebhookHealth,
  isAutomationActiveNow,
} from "@/lib/db";
import { rateLimit } from "@/lib/rate-limiter";
import { emitNewActivity } from "@/lib/activity-events";

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN!;
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN!;
const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID!;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || "";

// ─── GET — webhook verification handshake ───────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("[webhook] Verification failed — token mismatch");
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── Signature verification ─────────────────────────────────────────
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!APP_SECRET) {
    console.warn("[webhook] INSTAGRAM_APP_SECRET not set — skipping signature verification");
    return true;
  }
  if (!signatureHeader) {
    console.error("[webhook] Missing X-Hub-Signature-256 header");
    return false;
  }
  const expectedSig = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const expected = Buffer.from(expectedSig);
  const received = Buffer.from(signatureHeader);
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

// ─── Rate limit config ──────────────────────────────────────────────
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 100;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;

// ─── POST — incoming events ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Task #4: Rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const rl = rateLimit(clientIp, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.allowed) {
    console.warn(`[webhook] Rate limited IP ${clientIp}`);
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Task #7: Verify webhook signature from Meta
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature)) {
    console.error("[webhook] Invalid signature — rejecting request");
    return new NextResponse("Forbidden", { status: 403 });
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Acknowledge immediately (Instagram requires < 5 s response)
  processWebhookAsync(body).catch((err) =>
    console.error("[webhook] Async processing error:", err)
  );

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}

// ─── Core processing ─────────────────────────────────────────────────
async function processWebhookAsync(body: WebhookPayload) {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      // V10: Support comments, story/reel mentions
      const field = change.field;
      const isTriggerEvent =
        field === "comments" ||
        field === "mentions" ||
        field === "story_insights";

      if (!isTriggerEvent) continue;

      // V9: Track webhook health
      updateWebhookHealth(field);

      const value = change.value;

      const senderId: string | undefined = value?.from?.id;
      const senderUsername: string = value?.from?.username ?? "there";
      const commentText: string = value?.text ?? (value as Record<string, unknown> & { mentioned_in?: { text?: string } })?.mentioned_in?.text ?? "";
      const commentId: string = value?.id ?? "";

      if (!senderId) {
        console.warn("[webhook] No sender ID in payload — skipping:", JSON.stringify(value));
        continue;
      }

      console.log(`[webhook] ${field} from @${senderUsername} (${senderId}): "${commentText}"`);

      const automations = await getActiveAutomations();

      for (const automation of automations) {
        // V6: Schedule enforcement
        if (!isAutomationActiveNow(automation)) {
          console.log(`[webhook] Automation "${automation.name}" is outside scheduled hours — skipping`);
          continue;
        }

        const keywords: string[] = automation.trigger_keywords
          .split(",")
          .map((k: string) => k.trim().toLowerCase())
          .filter(Boolean);

        const lowerComment = commentText.toLowerCase();
        const matchedKeyword = keywords.find((kw) => lowerComment.includes(kw));

        if (!matchedKeyword) continue;

        console.log(`[webhook] Matched keyword "${matchedKeyword}" → automation "${automation.name}"`);

        // V2: Duplicate DM prevention
        if (hasDmBeenSent(automation.id, senderId)) {
          console.log(`[webhook] Duplicate DM skipped — already sent to ${senderId} for automation "${automation.name}"`);
          continue;
        }

        const dmText = personalizeMessage(automation.dm_message, senderUsername);
        let dmSent = false;
        let commentReplied = false;
        let errorMessage: string | undefined;

        // DM limit enforcement
        const userId = automation.user_id;
        if (userId) {
          const user = getUserById(userId);
          if (user && user.dm_limit !== -1 && user.dms_used_this_month >= user.dm_limit) {
            errorMessage = `DM limit reached (${user.dms_used_this_month}/${user.dm_limit})`;
            console.warn(`[webhook] ${errorMessage} for user ${userId} — skipping DM`);
            const activity = logActivity({
              automation_id: automation.id,
              automation_name: automation.name,
              instagram_user_id: senderId,
              instagram_username: senderUsername,
              comment_text: commentText,
              matched_keyword: matchedKeyword,
              dm_sent: false,
              comment_replied: false,
              error_message: errorMessage,
              user_id: userId,
            });
            emitNewActivity(userId, activity);
            break;
          }
        }

        // Send DM
        const dmResult = await sendDM(senderId, dmText, ACCESS_TOKEN, IG_ACCOUNT_ID);

        if (dmResult.success) {
          dmSent = true;
          console.log(`[webhook] DM sent to ${senderId} (message_id: ${dmResult.messageId})`);
          if (userId) incrementDmsUsed(userId);
          recordSentDm(automation.id, senderId);
        } else {
          errorMessage = dmResult.error;
          console.error(`[webhook] DM failed for ${senderId}:`, dmResult.error);
        }

        // Reply to comment (if configured, only for comment events)
        if (field === "comments" && automation.reply_comment && commentId) {
          const replyResult = await replyToComment(commentId, automation.reply_comment, ACCESS_TOKEN);
          commentReplied = replyResult.success;
          if (!replyResult.success) {
            console.error(`[webhook] Comment reply failed:`, replyResult.error);
          }
        }

        // Log to DB
        const activity = logActivity({
          automation_id: automation.id,
          automation_name: automation.name,
          instagram_user_id: senderId,
          instagram_username: senderUsername,
          comment_text: commentText,
          matched_keyword: matchedKeyword,
          dm_sent: dmSent,
          comment_replied: commentReplied,
          error_message: errorMessage,
          user_id: automation.user_id,
        });
        emitNewActivity(automation.user_id, activity);
      }
    }
  }
}

// ─── Types ────────────────────────────────────────────────────────────
interface WebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field: string;
      value?: {
        from?: { id: string; username?: string };
        text?: string;
        id?: string;
        media?: { id?: string };
      };
    }>;
  }>;
}