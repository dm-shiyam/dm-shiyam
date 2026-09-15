import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  sendDM,
  sendDmWithQuickReply,
  sendPrivateReply,
  replyToComment,
  personalizeMessage,
  humanizeMetaError,
  checkIsFollower,
} from "@/lib/instagram";
import {
  getActiveAutomations,
  getAutomationsForWebhookRouting,
  getAccountByInstagramId,
  logActivity,
  getUserById,
  claimDmSlot,
  claimDmSend,
  claimReply,
  releaseDmClaim,
  updateWebhookHealth,
  isAutomationActiveNow,
  markFirstDmSent,
  insertPendingFollowGate,
  claimPendingFollowGate,
  markFollowGateFailed,
  rejectPendingFollowGate,
  getAutomation,
} from "@/lib/db";
import {
  encodePostbackPayload,
  decodePostbackPayload,
  personalizeFollowGateMessage,
  DEFAULT_GATE_MESSAGE,
  GATE_BUTTON_TITLE,
} from "@/lib/follow-gate";
import { rateLimit } from "@/lib/rate-limiter";
import { emitNewActivity } from "@/lib/activity-events";
import { sendDmLimitWarning, sendDmLimitReached } from "@/lib/email";
import { captureError, captureAlert } from "@/lib/monitoring";

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
    captureAlert(
      "IG webhook: invalid signature",
      { route: "webhook/instagram", ip: clientIp, has_signature: signature !== null },
      "warning"
    );
    return new NextResponse("Forbidden", { status: 403 });
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  processWebhookAsync(body).catch((err) =>
    captureError(err, { route: "webhook/instagram", phase: "async_processing" })
  );

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}

async function processWebhookAsync(body: WebhookPayload) {
  for (const entry of body.entry ?? []) {
    // ── Multi-account routing (2026-09-09 fix) ────────────────────────────
    // `entry.id` is the IG account ID that received the event. Look up the
    // matching connected account so we can:
    //   1. Send DMs / private replies / comment replies with THAT account's
    //      access token — not the env-var fallback which is dm_shiyam's
    //      legacy token. Meta rejects cross-account calls with
    //      "The comment is invalid for a private reply".
    //   2. Only fire automations bound to this account (so a keyword-match
    //      on account A doesn't send a DM from account B).
    //   3. Use this account's own IG ID for the self-event loop guard.
    //
    // If `entry.id` is missing OR no matching account row exists, fall back
    // to the env-var single-tenant setup — same behavior as before this fix.
    const targetIgId = entry.id;
    const account = targetIgId
      ? await getAccountByInstagramId(targetIgId)
      : undefined;
    const accountAccessToken = account?.access_token ?? ACCESS_TOKEN;
    const ownIgAccountId = account?.instagram_account_id ?? IG_ACCOUNT_ID;

    if (targetIgId && !account) {
      console.warn(
        `[webhook] entry.id=${targetIgId} has no matching connected account — falling back to env-var token. This will fail unless the event is for the env-var account.`
      );
    }

    // ── V29: Handle messaging events (postback = quick-reply button tap) ──
    // These arrive on a separate top-level array from `changes`. Delegated
    // to handleMessagingEntry so the main comment-processing loop below
    // stays readable. Runs BEFORE the comment loop so postback + comment
    // in the same webhook batch (unusual but possible) unlock cleanly.
    if (entry.messaging?.length) {
      await handleMessagingEntry(entry.messaging, ownIgAccountId, accountAccessToken);
    }

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

      // ── Self-event guard: ignore comments/mentions authored by the account
      // that owns this webhook. Without this, the bot's own comment reply
      // triggers a new "comments" webhook whose text contains the trigger
      // keyword — causing an infinite reply loop. Uses the per-account IG ID
      // when we have one; falls back to env var for legacy setups.
      if (senderId === ownIgAccountId) {
        console.log(`[webhook] Ignoring self-authored ${field} from own IG account (${senderId})`);
        continue;
      }

      console.log(
        `[webhook] ${field} from @${senderUsername} (${senderId}) → account @${account?.instagram_username ?? "env-fallback"}: "${commentText}"`
      );

      // Two-tier routing so users don't have to explicitly assign every
      // automation to every account:
      //   * If we routed to a connected account, fetch automations that are
      //     EITHER bound to this account, OR unassigned but owned by the
      //     same user (safe: no cross-tenant leakage).
      //   * Env-var fallback (single-tenant legacy) → only unassigned
      //     automations with no account_id set.
      const automations = account
        ? await getAutomationsForWebhookRouting(account.id, account.user_id)
        : (await getActiveAutomations()).filter((a) => !a.account_id);

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
            // ── V29: Follow-to-Unlock branch ─────────────────────────────
            // If this automation has the follow gate enabled, DON'T send the
            // real dm_message yet. Instead:
            //   (1) queue a pending_follow_gates row with the REAL DM stored
            //       so button-tap AND timeout cron can both retrieve it,
            //   (2) send the "follow me first + tap ↓" DM with a quick-reply
            //       button whose payload encodes the gate row's id (HMAC-
            //       signed against forgery).
            // We still count this as `dmSent = true` for the activity log +
            // funnel milestone — we DID send a DM, just not the payload one.
            // Analytics distinguishes via sent_dms.sent_via_follow_gate.
            if (automation.follow_gate_enabled) {
              // V29.1 — Fast-follower bypass. Query Meta first to see if
              // this fan is already following the business account. If so,
              // skip the gate entirely and DM the real payload immediately
              // — much better UX for existing followers (no annoying
              // "please follow" prompt when they already do).
              //
              // If Meta returns null (permission scope, rate-limit, etc)
              // we FALL THROUGH to the gate rather than blocking — better
              // to over-ask than to leak the payload to a non-follower.
              const followCheck = await checkIsFollower(senderId, accountAccessToken);
              if (followCheck.isFollower === true) {
                console.log(
                  `[webhook] Fast-path: ${senderId} already follows — bypassing gate for automation "${automation.name}"`
                );
                const bypassResult = await sendPrivateReply(
                  commentId,
                  dmText,
                  accountAccessToken
                );
                if (bypassResult.success) {
                  dmSent = true;
                } else {
                  errorMessage = humanizeMetaError(bypassResult.error);
                  console.error(
                    `[webhook] Bypass DM failed for existing follower ${senderId}:`,
                    bypassResult.error
                  );
                }
                // Skip the gate insert + gate-DM path entirely.
                // Fall through to the activity log below.
              } else {
              const accountUsername =
                account?.instagram_username ?? "us";
              const gateTemplate =
                automation.follow_gate_message ?? DEFAULT_GATE_MESSAGE;
              const gateText = personalizeFollowGateMessage(
                gateTemplate,
                senderUsername,
                accountUsername
              );
              const timeoutSeconds =
                automation.follow_gate_timeout_seconds ?? 90;

              // Insert BEFORE sending so the button-tap round-trip (which
              // could be sub-second on IG) can never race the DB write.
              let gateRow;
              try {
                gateRow = await insertPendingFollowGate({
                  automation_id: automation.id,
                  account_id: account?.id ?? automation.account_id,
                  sender_ig_id: senderId,
                  sender_username: senderUsername,
                  comment_id: commentId,
                  comment_text: commentText,
                  real_dm_text: dmText,
                  timeout_seconds: timeoutSeconds,
                });
              } catch (err) {
                errorMessage = `Follow-gate insert failed: ${err instanceof Error ? err.message : String(err)}`;
                console.error(`[webhook] ${errorMessage}`);
              }

              if (gateRow) {
                const payload = encodePostbackPayload(gateRow.id);
                const gateResult = await sendDmWithQuickReply(
                  senderId,
                  gateText,
                  { title: GATE_BUTTON_TITLE, payload },
                  accountAccessToken
                );
                if (gateResult.success) {
                  dmSent = true;
                  console.log(
                    `[webhook] Follow-gate DM sent to ${senderId} (gate_id=${gateRow.id}, timeout=${timeoutSeconds}s)`
                  );
                } else {
                  errorMessage = humanizeMetaError(gateResult.error);
                  console.error(
                    `[webhook] Follow-gate DM failed for ${senderId}:`,
                    gateResult.error
                  );
                  // Send-side failure — mark the gate row failed so the
                  // timeout cron doesn't retry it 90s later. Fire-and-forget.
                  markFollowGateFailed(gateRow.id, gateResult.error ?? "send failed").catch(() => {});
                }
              }
              } // end else (not-following → gate path)
            } else {
            // Prefer POST /{comment-id}/private_replies for comment-triggered DMs —
            // Meta's dedicated API for this flow; more reliable delivery than /me/messages
            // and not restricted by the 24-hour messaging window.
            // Token + IG account ID come from the routed connected-account row
            // (see multi-account routing hoist at the top of processWebhookAsync).
            const dmResult =
              field === "comments"
                ? await sendPrivateReply(commentId, dmText, accountAccessToken)
                : await sendDM(senderId, dmText, accountAccessToken, ownIgAccountId);

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
              errorMessage = humanizeMetaError(dmResult.error);
              console.error(`[webhook] DM failed for ${senderId}:`, dmResult.error);
              // DM failed — do NOT release claim. Assume persistent failure
              // (blocked recipient, invalid ID, etc). Retry would just fail again.
            }
            } // end else (non-follow-gate branch)
          }
        }

        if (field === "comments" && automation.reply_comment && commentId) {
          // Atomically claim the reply — prevents duplicate replies on Meta retries.
          // This is critical: without this check, one comment can receive 100+ replies.
          if (await claimReply(commentId, automation.id)) {
            const replyResult = await replyToComment(commentId, automation.reply_comment, accountAccessToken);
            commentReplied = replyResult.success;
            if (!replyResult.success) {
              console.error(`[webhook] Comment reply failed:`, replyResult.error);
            }
          } else {
            console.log(`[webhook] Duplicate reply skipped for comment ${commentId}`);
          }
        }

        const activity = await logActivity({
          // Record the ROUTED account (which IG account received the event),
          // not automation.account_id — that's NULL for unassigned automations
          // and made the admin funnel + Activity tab unable to attribute rows
          // to accounts. Falls back to automation.account_id for legacy env
          // fallback path where `account` isn't set.
          account_id: account?.id ?? automation.account_id,
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

        // A9.1 — funnel milestone (write-once). Only fires on the actual first
        // successful send, and only if we know the owning user. Fire-and-forget.
        if (dmSent && automation.user_id) {
          markFirstDmSent(automation.user_id).catch((err) =>
            console.error("[funnel] markFirstDmSent failed:", err)
          );
        }
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
    // V29: Meta delivers postback (quick-reply button taps) and regular DM
    // texts under a separate `messaging` array on each entry (not `changes`).
    // See https://developers.facebook.com/docs/messenger-platform/instagram/features/quick-replies
    messaging?: Array<{
      sender?: { id: string };
      recipient?: { id: string };
      timestamp?: number;
      postback?: {
        mid?: string;
        title?: string;
        payload?: string;
      };
      message?: {
        mid?: string;
        text?: string;
        // A postback tap arrives EITHER as `postback` (recommended) OR as a
        // `message.quick_reply.payload` on some IG surfaces. Handle both.
        quick_reply?: { payload?: string };
      };
    }>;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// V29 — Follow-gate postback handler
// ─────────────────────────────────────────────────────────────────────────────
// Called from processWebhookAsync for each entry that has a `messaging` array.
// Looks for quick-reply postbacks with our FGATE:... payload prefix, atomically
// claims the pending gate, and sends the real DM.
//
// Non-follow-gate messaging events (regular DMs from fans, message reads,
// typing indicators) are ignored here — we intentionally don't build a
// full conversational agent, this is a one-shot unlock.
async function handleMessagingEntry(
  messagingList: NonNullable<NonNullable<WebhookPayload["entry"]>[number]["messaging"]>,
  ownIgAccountId: string,
  fallbackAccessToken: string
): Promise<void> {
  for (const evt of messagingList) {
    const senderId = evt.sender?.id;
    if (!senderId) continue;

    // Ignore echoes of messages WE sent (Meta bounces those back on some
    // apps). Recipient of an inbound event is always the business account,
    // sender is always the fan. If sender == our own IG ID, it's an echo.
    if (senderId === ownIgAccountId) continue;

    // Extract the postback payload — prefer explicit `postback.payload`, fall
    // back to `message.quick_reply.payload` (some IG versions route it here).
    const rawPayload = evt.postback?.payload ?? evt.message?.quick_reply?.payload;
    if (!rawPayload) continue;

    const decoded = decodePostbackPayload(rawPayload);
    if (!decoded) {
      // Either not our payload format or HMAC failed — silently ignore.
      // We deliberately don't log noisy warnings here; ManyChat and other
      // apps' users can be in the same DM thread and their postbacks would
      // trigger this path too.
      continue;
    }

    // Atomic claim — races the timeout cron. If cron already claimed this
    // row (state='unlocked_by_timeout') we get null and MUST NOT resend.
    const gate = await claimPendingFollowGate(decoded.gateId, "button");
    if (!gate) {
      console.log(
        `[webhook] Postback for gate ${decoded.gateId} — already claimed (timeout ran first?) — skipping`
      );
      continue;
    }

    // Resolve the account's token — we stored account_id on the gate row;
    // if for some reason it's null (legacy env-var fallback), use the
    // env-var token. Same pattern as the comment path.
    let accessToken = fallbackAccessToken;
    if (gate.account_id) {
      const acct = await import("@/lib/db").then((m) => m.getAccount(gate.account_id!));
      if (acct?.access_token) accessToken = acct.access_token;
    }

    // V29.1 — Real follow verification.
    // The fan tapped "I followed ✅", but tapping is free — anyone can lie.
    // Query Meta to see if they actually did. If `false`: send them a
    // "still not following!" nudge instead of the real DM, and mark the
    // gate row 'failed' with the reason (they can comment again to get a
    // fresh gate). If Meta returns null (unknown), fall back to trust:
    // send the real DM. Better UX to be wrong on one nudge than to
    // block a real follower over a transient Meta hiccup.
    const followCheck = await checkIsFollower(gate.sender_ig_id, accessToken);
    if (followCheck.isFollower === false) {
      console.log(
        `[webhook] Follow-gate DENIED for gate ${gate.id}: fan tapped but is_user_follow_business=false`
      );
      // We already claimed the row as unlocked_by_button in the atomic
      // claim above — overwrite to 'failed' so audit is clean.
      markFollowGateFailed(gate.id, "postback_tap_but_not_following").catch(() => {});
      // Send a friendly nudge so the fan knows why they didn't get the
      // promised DM. Fire-and-forget: even if this fails, the state is
      // already terminal.
      sendDM(
        gate.sender_ig_id,
        "Hmm, looks like you haven't followed us yet 👀 Please follow and comment again — I'll send the link right away!",
        accessToken,
        ownIgAccountId
      ).catch(() => {});
      continue;
    }
    // isFollower === true OR null (unknown) — proceed with the real DM.

    // Also fetch the automation for logging (name, user_id).
    const automation = await getAutomation(gate.automation_id);

    const dmResult = await sendDM(
      gate.sender_ig_id,
      gate.real_dm_text,
      accessToken,
      ownIgAccountId
    );

    if (dmResult.success) {
      console.log(
        `[webhook] Follow-gate UNLOCKED by button for gate ${gate.id} (verified=${followCheck.isFollower}) → real DM sent to ${gate.sender_ig_id}`
      );
      if (automation?.user_id) {
        markFirstDmSent(automation.user_id).catch(() => {});
      }
    } else {
      const errMsg = humanizeMetaError(dmResult.error) ?? "send failed";
      console.error(
        `[webhook] Follow-gate button unlock: real DM failed for gate ${gate.id}:`,
        dmResult.error
      );
      // We already flipped state to unlocked_by_button; overwrite to
      // 'failed' so ops can see it in the pending_follow_gates table.
      markFollowGateFailed(gate.id, errMsg).catch(() => {});
    }
  }
}