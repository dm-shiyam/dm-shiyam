import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendDM, sendPrivateReply, replyToComment, personalizeMessage } from "@/lib/instagram";
import {
  getActiveAutomations,
  logActivity,
  getUserById,
  claimDmSlot,
  claimDmSend,
  claimReply,
  releaseDmClaim,
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
      const mediaId: string = value?.media?.id ?? "";

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

        // Require both a comment ID and a media/post ID. The comment ID enables
        // per-comment dedup (Meta retries); the media ID scopes the per-post
        // rate limit (max 3 DMs per recipient per post).
        if (!commentId || !mediaId) {
          console.warn(`[webhook] Missing commentId or mediaId — skipping to avoid unsafe send`);
          continue;
        }

        // Atomically claim the right to send. Two failure modes:
        //   - duplicate:     Meta re-delivered this same comment → skip DM + reply
        //   - rate_limited:  fresh comment, but recipient hit 3-DM cap on this post → skip DM, still reply
        const claim = await claimDmSend(automation.id, commentId, mediaId, senderId);
        if (!claim.claimed && claim.reason === "duplicate") {
          console.log(`[webhook] Duplicate skipped — comment ${commentId} already processed`);
          continue;
        }

        const dmText = personalizeMessage(automation.dm_message, senderUsername);
        let dmSent = false;
        let commentReplied = false;
        let errorMessage: string | undefined;

        if (claim.reason === "rate_limited") {
          errorMessage = `Rate limit: max 3 DMs per recipient per post`;
          console.warn(`[webhook] ${errorMessage} — user ${senderId} on media ${mediaId} — skipping DM (reply still allowed)`);
        }

        const userId = automation.user_id;

        // Only attempt the actual DM if the per-post rate limit didn't block us.
        // When rate-limited we still fall through to the reply section below.
        if (claim.claimed) {
          // Atomically claim one DM slot from the user's monthly quota.
          // Single UPDATE with a conditional WHERE — no check-then-act race.
          // If limit reached, release the DM claim so user retriggers after quota resets.
          let slotUsed: number | undefined;
          let slotLimit: number | undefined;
          let planLimitBlocked = false;

          if (userId) {
            const slot = await claimDmSlot(userId);
            if (slot && !slot.claimed) {
              // Plan quota exhausted — release the earlier DM claim so this comment can
              // be retriggered on a future webhook (e.g. after monthly quota reset).
              await releaseDmClaim(automation.id, commentId);
              errorMessage = `DM limit reached (${slot.used}/${slot.limit})`;
              console.warn(`[webhook] ${errorMessage} for user ${userId} — skipping DM`);
              const user = await getUserById(userId);
              if (user?.email) {
                sendDmLimitReached({ to: user.email, name: user.name || "", limit: slot.limit }).catch(() => {});
              }
              planLimitBlocked = true;
            } else if (slot?.claimed) {
              slotUsed = slot.used;
              slotLimit = slot.limit;
            }
          }

          if (!planLimitBlocked) {
            // Prefer POST /{comment-id}/private_replies for comment-triggered DMs —
            // Meta's dedicated API for this flow; more reliable delivery than /me/messages
            // and not restricted by the 24-hour messaging window.
            const dmResult =
              field === "comments"
                ? await sendPrivateReply(commentId, dmText, ACCESS_TOKEN)
                : await sendDM(senderId, dmText, ACCESS_TOKEN, IG_ACCOUNT_ID);

            if (dmResult.success) {
              dmSent = true;
              const idLabel = "messageId" in dmResult && dmResult.messageId
                ? ` (message_id: ${dmResult.messageId})`
                : "";
              const via = field === "comments" ? "private_replies" : "messages";
              console.log(`[webhook] DM sent to ${senderId}${idLabel} via ${via}`);
              // 80% threshold email — use pre-increment values from claimDmSlot to detect crossing
              if (userId && slotUsed !== undefined && slotLimit !== undefined && slotLimit !== -1) {
                const prevPct = (slotUsed - 1) / slotLimit;
                const pct = slotUsed / slotLimit;
                if (pct >= 0.8 && prevPct < 0.8) {
                  const user = await getUserById(userId);
                  if (user?.email) {
                    sendDmLimitWarning({
                      to: user.email,
                      name: user.name || "",
                      used: slotUsed,
                      limit: slotLimit,
                    }).catch(() => {});
                  }
                }
              }
            } else {
              errorMessage = dmResult.error;
              console.error(`[webhook] DM failed for ${senderId}:`, dmResult.error);
              // DM failed — do NOT release claim. Assume persistent failure
              // (blocked recipient, invalid ID, etc). Retry would just fail again.
            }
          }
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