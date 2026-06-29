// api/accounts/token/route.ts
// Token exchange & refresh endpoints

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAccount,
  updateAccount,
  getAllAccounts,
  getAccountsWithExpiringTokens,
} from "@/lib/db";
import {
  exchangeForLongLivedToken,
  getPageAccessToken,
  refreshLongLivedToken,
  debugToken,
  computeExpiryDate,
} from "@/lib/token-manager";

const APP_ID = process.env.INSTAGRAM_APP_ID!;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;

/**
 * POST /api/accounts/token
 * Actions: "exchange" | "refresh" | "debug" | "refresh-all"
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!APP_ID || !APP_SECRET) {
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be configured" },
      { status: 500 }
    );
  }

  let body: {
    action: string;
    account_id?: string;
    short_lived_token?: string;
    page_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  // ── Exchange short-lived → long-lived token ──
  if (action === "exchange") {
    const { short_lived_token, account_id, page_id } = body;
    if (!short_lived_token) {
      return NextResponse.json({ error: "short_lived_token is required" }, { status: 400 });
    }

    // Step 1: Exchange for long-lived user token
    const exchangeResult = await exchangeForLongLivedToken(short_lived_token, APP_ID, APP_SECRET);
    if (!exchangeResult.success || !exchangeResult.access_token) {
      return NextResponse.json({ error: exchangeResult.error }, { status: 400 });
    }

    let finalToken = exchangeResult.access_token;
    let expiresAt = computeExpiryDate(exchangeResult.expires_in ?? 5184000);

    // Step 2: If page_id is provided, get a never-expiring page token
    if (page_id) {
      const pageResult = await getPageAccessToken(exchangeResult.access_token, page_id);
      if (pageResult.success && pageResult.access_token) {
        finalToken = pageResult.access_token;
        expiresAt = null; // page tokens from long-lived user tokens don't expire
      }
    }

    // Step 3: Update the account in DB
    if (account_id) {
      const account = getAccount(account_id);
      if (!account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      updateAccount(account_id, {
        access_token: finalToken,
        token_expires_at: expiresAt,
      });
    }

    return NextResponse.json({
      success: true,
      token_type: page_id ? "page_long_lived" : "user_long_lived",
      expires_at: expiresAt,
      never_expires: expiresAt === null,
      account_updated: !!account_id,
    });
  }

  // ── Refresh an existing long-lived token ──
  if (action === "refresh") {
    const { account_id } = body;
    if (!account_id) {
      return NextResponse.json({ error: "account_id is required" }, { status: 400 });
    }

    const account = getAccount(account_id);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const result = await refreshLongLivedToken(account.access_token, APP_ID, APP_SECRET);
    if (!result.success || !result.access_token) {
      return NextResponse.json({
        error: result.error,
        hint: "Token may have expired. Generate a new short-lived token and use the 'exchange' action.",
      }, { status: 400 });
    }

    const expiresAt = computeExpiryDate(result.expires_in ?? 5184000);
    updateAccount(account_id, {
      access_token: result.access_token,
      token_expires_at: expiresAt,
    });

    return NextResponse.json({
      success: true,
      expires_at: expiresAt,
    });
  }

  // ── Refresh all accounts with expiring tokens ──
  if (action === "refresh-all") {
    const expiringAccounts = getAccountsWithExpiringTokens(7);
    const results: Array<{ account_id: string; username: string; success: boolean; error?: string }> = [];

    for (const account of expiringAccounts) {
      const result = await refreshLongLivedToken(account.access_token, APP_ID, APP_SECRET);
      if (result.success && result.access_token) {
        const expiresAt = computeExpiryDate(result.expires_in ?? 5184000);
        updateAccount(account.id, {
          access_token: result.access_token,
          token_expires_at: expiresAt,
        });
        results.push({ account_id: account.id, username: account.instagram_username, success: true });
      } else {
        results.push({ account_id: account.id, username: account.instagram_username, success: false, error: result.error });
      }
    }

    return NextResponse.json({
      total_checked: expiringAccounts.length,
      results,
    });
  }

  // ── Debug a token ──
  if (action === "debug") {
    const { account_id } = body;
    if (!account_id) {
      return NextResponse.json({ error: "account_id is required" }, { status: 400 });
    }

    const account = getAccount(account_id);
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const appToken = `${APP_ID}|${APP_SECRET}`;
    const info = await debugToken(account.access_token, appToken);

    return NextResponse.json({
      is_valid: info.is_valid,
      expires_at: info.expires_at === 0
        ? "never"
        : new Date(info.expires_at * 1000).toISOString(),
      scopes: info.scopes,
      stored_expiry: account.token_expires_at,
      error: info.error,
    });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

/**
 * GET /api/accounts/token
 * Returns token status for all accounts
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = getAllAccounts();
  const statuses = accounts.map((acc) => {
    const expiresAt = acc.token_expires_at;
    let status: "valid" | "expiring_soon" | "expired" | "never_expires" | "unknown" = "unknown";

    if (!expiresAt) {
      status = "never_expires";
    } else {
      const expiryTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      if (expiryTime < now) status = "expired";
      else if (expiryTime - now < sevenDays) status = "expiring_soon";
      else status = "valid";
    }

    return {
      account_id: acc.id,
      username: acc.instagram_username,
      token_expires_at: expiresAt,
      status,
    };
  });

  return NextResponse.json(statuses);
}
