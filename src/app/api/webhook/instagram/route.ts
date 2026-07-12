import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendDM, sendPrivateReply, replyToComment, personalizeMessage } from "@/lib/instagram";
import {
  getActiveAutomations,
  logActivity,
  getUserById,
  incrementDmsUsed,
  claimDmSend,
  claimReply,
  updateWebhookHealth,
  isAutomationActiveNow,
} from "@/lib/db";
import { rateLimit } from "@/lib/rate-limiter";
import { emitNewActivity } from "@/lib/activity-events";
import { sendDmLimitWarning, sendDmLimitReached } from "@/lib/email";

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN!;
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN!;
const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID!;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || "";

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

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!APP_SECRET) {
    if (process.env.NODE_ENV === "production") {
      // Never skip signature verification in production — fail closed
      console.error("[webhook] INSTAGRAM_APP_SECRET not set in production — rejecting request");
      return false;
    }
    console.warn("[webhook] INSTAGRAM_APP_SECRET not set — skipping signature verification (dev only)");
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

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 100;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;

export async function POST(req: NextRequest) {
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

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

  processWebhookAsync(body).catch((err) =>
    console.error("[webhook] Async processing error:", err)
  );

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}

async function processWebhookAsync(body: WebhookPayload) {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const field = change.field;
      const isTriggerEvent =
        field === "comments" || field === "mentions" || field === "story_insights";

      if (!isTriggerEvent) continue;

      await updateWebhookHealth(field);

      const value = change.value;
      const senderId: string | undefined = value?.from?.id;
      const senderUsername: string = value?.from?.username ?? "there";
      const commentText: string =
        value?.text ??
        (value as Record<string, unknown> & { mentioned_in?: { text?: string } })
          ?.mentioned_in?.text ??
        "";
      const commentId: string = value?.id ?? "";

      if (!senderId) {
        console.warn("[webhook] No sender ID in payload — skipping:", JSON.stringify(value));
        continue;
      }

      // ── Self-event guard: ignore comments/mentions authored by our own IG account ──
      // Without this, the bot's own comment reply triggers a new "comments" webhook,
      // whose text usually contains the trigger keyword — causing an infinite reply loop.
      if (senderId === IG_ACCOUNT_ID) {
        console.log(`[webhook] Ignoring self-authored ${field} from own IG account (${senderId})`);
        continue;
      }

      console.log(`[webhook] ${field} from @${senderUsername} (${senderId}): "${commentText}"`);

      const automations = await getActiveAutomations();

      for (const automation of automations) {
        if (!isAutomationActiveNow(automation)) {
          console.log(`[webhook] Automation "${automation.name}" outside scheduled hours — skipping`);
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

        // Atomically claim the right to send for THIS comment. If false,
        // another concurrent webhook (or a Meta retry with the same
        // comment_id) already claimed it — skip. Same user commenting a
        // NEW comment gets a NEW claim (per-comment behavior).
        if (commentId && !(await claimDmSend(automation.id, commentId, senderId))) {
          console.log(`[webhook] Duplicate skipped — comment ${commentId} already claimed for automation ${automation.id}`);
          continue;
        }

        const dmText = personalizeMessage(automation.dm_message, senderUsername);
        let dmSent = false;
        let commentReplied = false;
        let errorMessage: string | undefined;

        const userId = automation.user_id;
        if (userId) {
          const user = await getUserById(userId);
          if (user && user.dm_limit !== -1 && user.dms_used_this_month >= user.dm_limit) {
            errorMessage = `DM limit reached (${user.dms_used_this_month}/${user.dm_limit})`;
            console.warn(`[webhook] ${errorMessage} for user ${userId} — skipping DM`);
            // Send limit-reached email (fire-and-forget)
            if (user.email) {
              sendDmLimitReached({ to: user.email, name: user.name || "", limit: user.dm_limit }).catch(() => {});
            }
            const activity = await logActivity({
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

        // Prefer POST /{comment-id}/private_replies for comment-triggered DMs —
        // Meta's dedicated API for this flow; more reliable delivery than /me/messages
        // and not restricted by the 24-hour messaging window.
        const dmResult =
          field === "comments" && commentId
            ? await sendPrivateReply(commentId, dmText, ACCESS_TOKEN)
            : await sendDM(senderId, dmText, ACCESS_TOKEN, IG_ACCOUNT_ID);

        if (dmResult.success) {
          dmSent = true;
          const idLabel = "messageId" in dmResult && dmResult.messageId ? ` (message_id: ${dmResult.messageId})` : "";
          console.log(`[webhook] DM sent to ${senderId}${idLabel} via ${field === "comments" && commentId ? "private_replies" : "messages"}`);
          if (userId) {
            await incrementDmsUsed(userId);
            // Check if user just crossed 80% threshold
            const updatedUser = await getUserById(userId);
            if (updatedUser && updatedUser.dm_limit !== -1 && updatedUser.email) {
              const pct = updatedUser.dms_used_this_month / updatedUser.dm_limit;
              const prevPct = (updatedUser.dms_used_this_month - 1) / updatedUser.dm_limit;
              if (pct >= 0.8 && prevPct < 0.8) {
                sendDmLimitWarning({
                  to: updatedUser.email,
                  name: updatedUser.name || "",
                  used: updatedUser.dms_used_this_month,
                  limit: updatedUser.dm_limit,
                }).catch(() => {});
              }
            }
          }
          // No need to record — claimDmSend already inserted the row above
        } else {
          errorMessage = dmResult.error;
          console.error(`[webhook] DM failed for ${senderId}:`, dmResult.error);
        }

        if (field === "comments" && automation.reply_comment && commentId) {
          // Atomically claim the reply — prevents duplicate replies on Meta retries.
          // This is critical: without this check, one comment can receive 100+ replies.
          if (await claimReply(commentId, automation.id)) {
            const replyResult = await replyToComment(commentId, automation.reply_comment, ACCESS_TOKEN);
            commentReplied = replyResult.success;
            if (!replyResult.success) {
              console.error(`[webhook] Comment reply failed:`, replyResult.error);
            }
          } else {
            console.log(`[webhook] Duplicate reply skipped for comment ${commentId}`);
          }
        }

        const activity = await logActivity({
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