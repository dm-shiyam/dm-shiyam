// src/app/api/admin/webhook-health/route.ts
// Per-account IG webhook / token / DM health for the admin dashboard.
// Also allows admins to trigger a re-subscribe on any account (POST).
//
// Diagnoses the "auto-DM stopped after Meta review" class of bugs:
//   - Token expired or expiring soon
//   - Account no longer subscribed to `comments` / `messages` webhook fields
//   - No DM sent recently even though account looks healthy

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import {
  isAdmin,
  getAllAccounts,
  getWebhookHealth,
  getAccount,
} from "@/lib/db";
import { queryOne } from "@/lib/db-client";
import {
  getAccountSubscription,
  subscribeAccountToWebhooks,
} from "@/lib/instagram-subscription";

export const dynamic = "force-dynamic";
// Meta calls can be slow when we do N of them in parallel — bump the timeout.
export const maxDuration = 30;

// Fields we care about — must match `SUBSCRIBED_FIELDS` in instagram-subscription.ts
const REQUIRED_FIELDS = ["comments", "messages"] as const;

type AccountHealth = {
  account_id: string;
  user_id?: string;
  instagram_username: string;
  instagram_account_id: string;
  is_active: boolean;

  token: {
    expires_at: string | null;
    days_until_expiry: number | null;
    status: "ok" | "expiring_soon" | "expired" | "unknown";
  };

  subscription: {
    fields: string[]; // what Meta says we're subscribed to
    ok: boolean; // all REQUIRED_FIELDS present
    missing: string[];
    error?: string;
  };

  last_dm_sent_at: string | null; // most recent sent_dms row for this account
  overall: "healthy" | "warning" | "critical";
};

function daysBetween(now: Date, then: Date): number {
  return Math.floor((then.getTime() - now.getTime()) / 86_400_000);
}

async function buildAccountHealth(acct: Awaited<ReturnType<typeof getAllAccounts>>[number]): Promise<AccountHealth> {
  // ── token ──
  const now = new Date();
  const expiresAt = acct.token_expires_at ? new Date(acct.token_expires_at) : null;
  const daysLeft = expiresAt ? daysBetween(now, expiresAt) : null;
  const tokenStatus: AccountHealth["token"]["status"] = !expiresAt
    ? "unknown"
    : daysLeft! < 0
      ? "expired"
      : daysLeft! < 7
        ? "expiring_soon"
        : "ok";

  // ── live subscription check against Meta ──
  let subFields: string[] = [];
  let subError: string | undefined;
  try {
    const sub = await getAccountSubscription(acct.instagram_account_id, acct.access_token);
    if (sub.ok && sub.data) {
      // Meta returns [{ subscribed_fields: [...] }] for our app
      subFields = sub.data[0]?.subscribed_fields ?? [];
    } else {
      subError = sub.error?.message ?? "unknown error";
    }
  } catch (err) {
    subError = err instanceof Error ? err.message : String(err);
  }
  const missing = REQUIRED_FIELDS.filter((f) => !subFields.includes(f));
  const subOk = missing.length === 0 && !subError;

  // ── last DM sent for this account ──
  // sent_dms → automations → account_id. Some automations may not have an
  // account_id (older rows). We only return the most recent that we CAN
  // attribute; missing account_id rows simply won't show up here.
  const lastDmRow = await queryOne<{ created_at: string }>(
    `SELECT sd.created_at
     FROM sent_dms sd
     JOIN automations a ON a.id = sd.automation_id
     WHERE a.account_id = $1
     ORDER BY sd.created_at DESC
     LIMIT 1`,
    [acct.id],
  );
  const lastDmSentAt = lastDmRow?.created_at ?? null;

  // ── overall triage ──
  let overall: AccountHealth["overall"] = "healthy";
  if (
    tokenStatus === "expired" ||
    !subOk ||
    !acct.is_active
  ) {
    overall = "critical";
  } else if (tokenStatus === "expiring_soon") {
    overall = "warning";
  }

  return {
    account_id: acct.id,
    user_id: acct.user_id,
    instagram_username: acct.instagram_username,
    instagram_account_id: acct.instagram_account_id,
    is_active: acct.is_active,
    token: {
      expires_at: acct.token_expires_at ?? null,
      days_until_expiry: daysLeft,
      status: tokenStatus,
    },
    subscription: {
      fields: subFields,
      ok: subOk,
      missing,
      error: subError,
    },
    last_dm_sent_at: lastDmSentAt,
    overall,
  };
}

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [accounts, globalHealth] = await Promise.all([
      getAllAccounts(),
      getWebhookHealth(),
    ]);

    // Parallelize Meta calls — cheaper than serial for 10+ accounts.
    const perAccount = await Promise.all(accounts.map(buildAccountHealth));

    // Summary counts for the dashboard header
    const summary = {
      total: perAccount.length,
      healthy: perAccount.filter((a) => a.overall === "healthy").length,
      warning: perAccount.filter((a) => a.overall === "warning").length,
      critical: perAccount.filter((a) => a.overall === "critical").length,
    };

    return NextResponse.json({
      summary,
      global_webhook: globalHealth
        ? {
            last_received_at: globalHealth.last_received_at,
            last_event_type: globalHealth.last_event_type,
            total_received: globalHealth.total_received,
          }
        : null,
      accounts: perAccount,
    });
  } catch (err) {
    console.error("[admin/webhook-health] error:", err);
    return NextResponse.json({ error: "Failed to load webhook health" }, { status: 500 });
  }
}

// POST → re-subscribe a single account. Body: { account_id: string }
// Fixes the #2 root cause of "auto-DM stopped": account got un-subscribed
// from webhook fields during Meta app mode transition.
export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { account_id?: string };
    if (!body.account_id) {
      return NextResponse.json({ error: "account_id required" }, { status: 400 });
    }

    const acct = await getAccount(body.account_id);
    if (!acct) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const result = await subscribeAccountToWebhooks(
      acct.instagram_account_id,
      acct.access_token,
    );

    // Server-log audit trail. If we ever add a dedicated admin_audit_log
    // table this is the single place to hook it in.
    console.log(
      `[admin/webhook-health] resubscribe admin=${userId} acct=${acct.id} ` +
        `ig=${acct.instagram_username} ok=${result.ok}` +
        (result.error?.message ? ` err="${result.error.message}"` : ""),
    );

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    console.error("[admin/webhook-health POST] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Re-subscribe failed" },
      { status: 500 },
    );
  }
}
