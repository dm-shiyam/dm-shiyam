// src/app/api/cron/dispatch-follow-gates/route.ts
// V29 — Timeout dispatcher for the Follow-to-Unlock feature.
//
// Runs once daily (03:15 UTC = 08:45 IST). Finds any pending_follow_gates
// rows whose `timeout_at` has passed without a button-tap and sends the
// real DM to the fan. This is the "we trust you followed" fallback.
//
// Why once daily (and not */5 as originally planned):
//   Vercel Hobby (free) tier caps crons at once-per-day. */5 * * * * is
//   rejected at deploy time with "Hobby accounts are limited to daily
//   cron jobs". Upgrading to Pro (~$20/mo) unlocks per-minute crons.
//
// Practical impact:
//   * BUTTON-TAP PATH (primary flow): instant, unaffected — the postback
//     handler in the webhook sends the real DM within ~1s of the tap.
//   * TIMEOUT PATH (fallback for fans who didn't tap): effective wait can
//     be up to 24h from the moment the fan commented, regardless of the
//     configured follow_gate_timeout_seconds. The AutomationEditor UI
//     honestly documents this so users can weigh whether to enable the
//     gate on time-sensitive campaigns.
//
// Auth: standard Bearer <CRON_SECRET> pattern, matches other crons.
// Batch size: 100 per invocation to stay well under Meta's 100 msg/s cap.
//
// Idempotency: uses claimPendingFollowGate() which atomically transitions
// state='pending' → 'unlocked_by_timeout' in a single UPDATE. If the button
// path racefully claimed the same row seconds earlier, we get null back
// and skip cleanly.

import { NextRequest, NextResponse } from "next/server";
import {
  getExpiredPendingGates,
  claimPendingFollowGate,
  markFollowGateFailed,
  getAccount,
  getAutomation,
  markFirstDmSent,
} from "@/lib/db";
import { sendDM, humanizeMetaError } from "@/lib/instagram";
import { captureError, captureAlert } from "@/lib/monitoring";

const CRON_SECRET = process.env.CRON_SECRET || "";
const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || "";
const FALLBACK_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || "";

async function handler(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "") || "";
    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expired = await getExpiredPendingGates(100);
    console.log(`[cron:dispatch-follow-gates] Found ${expired.length} expired gates`);

    let dispatched = 0;
    let failed = 0;
    let skipped = 0;
    const results: Array<{ gate_id: string; result: string; error?: string }> = [];

    for (const gate of expired) {
      // Atomic claim — races the button postback handler. If the fan tapped
      // between the SELECT above and this UPDATE, we get null and MUST NOT
      // send a duplicate.
      const claimed = await claimPendingFollowGate(gate.id, "timeout");
      if (!claimed) {
        skipped++;
        results.push({ gate_id: gate.id, result: "already_claimed" });
        continue;
      }

      // Resolve the account's access token. If the gate row has an
      // account_id, use that account's token; otherwise fall back to the
      // env-var single-tenant token (legacy).
      let accessToken = FALLBACK_TOKEN;
      let ownIgId = IG_ACCOUNT_ID;
      if (claimed.account_id) {
        const acct = await getAccount(claimed.account_id);
        if (acct?.access_token) accessToken = acct.access_token;
        if (acct?.instagram_account_id) ownIgId = acct.instagram_account_id;
      }

      const dmResult = await sendDM(
        claimed.sender_ig_id,
        claimed.real_dm_text,
        accessToken,
        ownIgId
      );

      if (dmResult.success) {
        dispatched++;
        results.push({ gate_id: gate.id, result: "dispatched" });
        console.log(
          `[cron:dispatch-follow-gates] Timeout-dispatched real DM for gate ${gate.id} → ${claimed.sender_ig_id}`
        );

        // Funnel milestone (fire-and-forget)
        const automation = await getAutomation(claimed.automation_id);
        if (automation?.user_id) {
          markFirstDmSent(automation.user_id).catch(() => {});
        }
      } else {
        failed++;
        const errMsg = humanizeMetaError(dmResult.error) ?? "send failed";
        results.push({ gate_id: gate.id, result: "failed", error: errMsg });
        console.error(
          `[cron:dispatch-follow-gates] Real DM failed for gate ${gate.id}:`,
          dmResult.error
        );
        // Overwrite state to 'failed' so ops can see it. claimPendingFollowGate
        // already flipped to 'unlocked_by_timeout' — this makes it terminal-failed.
        markFollowGateFailed(gate.id, errMsg).catch(() => {});
      }
    }

    if (failed > 0) {
      captureAlert(
        `cron:dispatch-follow-gates had ${failed} failures`,
        {
          route: "cron/dispatch-follow-gates",
          total: expired.length,
          dispatched,
          failed,
          skipped,
        },
        "warning"
      );
    }

    return NextResponse.json({
      dispatched_at: new Date().toISOString(),
      total_expired: expired.length,
      dispatched,
      failed,
      skipped,
      results,
    });
  } catch (err) {
    captureError(err, { route: "cron/dispatch-follow-gates" });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handler(req);
}
export async function POST(req: NextRequest) {
  return handler(req);
}
