// api/cron/refresh-tokens/route.ts
// Daily cron: refresh Instagram tokens expiring within 7 days
// Called by Vercel Cron at 6am UTC daily

import { NextRequest, NextResponse } from "next/server";
import { getAccountsWithExpiringTokens, updateAccount } from "@/lib/db";
import { refreshLongLivedToken, computeExpiryDate } from "@/lib/token-manager";

const CRON_SECRET = process.env.CRON_SECRET || "";
const APP_ID = process.env.INSTAGRAM_APP_ID!;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;

async function handler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "") || "";

  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!APP_ID || !APP_SECRET) {
    return NextResponse.json({ error: "Instagram credentials not configured" }, { status: 500 });
  }

  const expiringAccounts = getAccountsWithExpiringTokens(7);
  console.log(`[cron:refresh-tokens] Found ${expiringAccounts.length} accounts with expiring tokens`);

  const results: Array<{ account_id: string; username: string; success: boolean; error?: string }> = [];

  for (const account of expiringAccounts) {
    const result = await refreshLongLivedToken(account.access_token, APP_ID, APP_SECRET);
    if (result.success && result.access_token) {
      const expiresAt = computeExpiryDate(result.expires_in ?? 5184000);
      updateAccount(account.id, { access_token: result.access_token, token_expires_at: expiresAt });
      results.push({ account_id: account.id, username: account.instagram_username, success: true });
      console.log(`[cron:refresh-tokens] Refreshed token for @${account.instagram_username}`);
    } else {
      results.push({ account_id: account.id, username: account.instagram_username, success: false, error: result.error });
      console.error(`[cron:refresh-tokens] Failed for @${account.instagram_username}:`, result.error);
    }
  }

  return NextResponse.json({
    refreshed_at: new Date().toISOString(),
    total_checked: expiringAccounts.length,
    results,
  });
}

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }
