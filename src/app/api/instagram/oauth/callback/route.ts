// GET /api/instagram/oauth/callback
// Handles the Instagram Business Login OAuth redirect.
//   1. Verify signed state → recover userId
//   2. Exchange authorization code for short-lived token (POST api.instagram.com/oauth/access_token)
//   3. Exchange short-lived for long-lived 60-day token (GET graph.instagram.com/access_token)
//   4. Fetch IG account details (GET graph.instagram.com/me)
//   5. Persist via createAccount() (or updateAccount if same IG id already connected)

import { NextRequest, NextResponse } from "next/server";
import { verifyState } from "@/lib/oauth-state";
import {
  createAccount,
  getAccountByInstagramId,
  updateAccount,
} from "@/lib/db";
import { subscribeAccountToWebhooks } from "@/lib/instagram-subscription";

const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const LONG_LIVED_URL = "https://graph.instagram.com/access_token";
const ME_URL = "https://graph.instagram.com/me";

function getRedirectUri(req: NextRequest): string {
  const explicit = process.env.INSTAGRAM_REDIRECT_URI;
  if (explicit) return explicit;
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");
  return `${proto}://${host}/api/instagram/oauth/callback`;
}

function dashboardRedirect(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/dashboard", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, { status: 302 });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription =
    url.searchParams.get("error_description") ||
    url.searchParams.get("error_reason");

  // User denied consent on the IG screen, or Meta returned an error
  if (error) {
    console.warn("[ig-oauth] user denied or error:", error, errorDescription);
    return dashboardRedirect(req, {
      ig_error: error,
      ig_error_desc: errorDescription || "",
    });
  }

  if (!code || !state) {
    return dashboardRedirect(req, { ig_error: "missing_params" });
  }

  const stateCheck = verifyState(state);
  if (!stateCheck.ok) {
    console.warn("[ig-oauth] state verification failed:", stateCheck.reason);
    return dashboardRedirect(req, { ig_error: "bad_state" });
  }
  const userId = stateCheck.userId;

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    console.error("[ig-oauth] INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET missing");
    return dashboardRedirect(req, { ig_error: "misconfigured" });
  }

  const redirectUri = getRedirectUri(req);

  // ── Step 1: exchange code for short-lived token ──
  let shortLived: { access_token: string; user_id: string | number };
  try {
    const form = new URLSearchParams();
    form.set("client_id", appId);
    form.set("client_secret", appSecret);
    form.set("grant_type", "authorization_code");
    form.set("redirect_uri", redirectUri);
    form.set("code", code);

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await res.json();
    if (!res.ok || !data?.access_token) {
      console.error("[ig-oauth] code→short-lived failed:", data);
      return dashboardRedirect(req, {
        ig_error: "code_exchange_failed",
        ig_error_desc: data?.error_message || `HTTP ${res.status}`,
      });
    }
    shortLived = data;
  } catch (err) {
    console.error("[ig-oauth] code→short-lived threw:", err);
    return dashboardRedirect(req, { ig_error: "code_exchange_error" });
  }

  // ── Step 2: swap short-lived for long-lived (60 days) ──
  let longLived: { access_token: string; expires_in: number };
  try {
    const u = new URL(LONG_LIVED_URL);
    u.searchParams.set("grant_type", "ig_exchange_token");
    u.searchParams.set("client_secret", appSecret);
    u.searchParams.set("access_token", shortLived.access_token);

    const res = await fetch(u.toString());
    const data = await res.json();
    if (!res.ok || !data?.access_token) {
      console.error("[ig-oauth] short→long failed:", data);
      return dashboardRedirect(req, {
        ig_error: "long_lived_failed",
        ig_error_desc: data?.error?.message || `HTTP ${res.status}`,
      });
    }
    longLived = data;
  } catch (err) {
    console.error("[ig-oauth] short→long threw:", err);
    return dashboardRedirect(req, { ig_error: "long_lived_error" });
  }

  const expiresAt = new Date(
    Date.now() + (longLived.expires_in ?? 5184000) * 1000
  ).toISOString();

  // ── Step 3: fetch profile (id + username) ──
  let profile: { user_id?: string; id?: string; username: string };
  try {
    const u = new URL(ME_URL);
    u.searchParams.set("fields", "user_id,username");
    u.searchParams.set("access_token", longLived.access_token);
    const res = await fetch(u.toString());
    const data = await res.json();
    if (!res.ok || !data?.username) {
      console.error("[ig-oauth] /me failed:", data);
      return dashboardRedirect(req, {
        ig_error: "profile_fetch_failed",
        ig_error_desc: data?.error?.message || `HTTP ${res.status}`,
      });
    }
    profile = data;
  } catch (err) {
    console.error("[ig-oauth] /me threw:", err);
    return dashboardRedirect(req, { ig_error: "profile_fetch_error" });
  }

  const instagramAccountId = String(
    profile.user_id ?? profile.id ?? shortLived.user_id
  );
  const username = profile.username;

  // ── Step 4: persist account (upsert by instagram_account_id) ──
  try {
    const existing = await getAccountByInstagramId(instagramAccountId);
    if (existing) {
      // Only allow the original owner to refresh the token via OAuth. If a different
      // user tries to connect the same IG account, reject to prevent hijack.
      if (existing.user_id && existing.user_id !== userId) {
        console.warn(
          "[ig-oauth] IG account already bound to another user:",
          instagramAccountId
        );
        return dashboardRedirect(req, { ig_error: "already_connected" });
      }
      await updateAccount(existing.id, {
        instagram_username: username,
        access_token: longLived.access_token,
        token_expires_at: expiresAt,
        is_active: true,
      });
    } else {
      await createAccount({
        instagram_account_id: instagramAccountId,
        instagram_username: username,
        access_token: longLived.access_token,
        token_expires_at: expiresAt,
        user_id: userId,
      });
    }
  } catch (err) {
    console.error("[ig-oauth] persist failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return dashboardRedirect(req, {
      ig_error: "persist_failed",
      ig_error_desc: msg,
    });
  }

  // ── Step 5: subscribe the account to webhook events ──
  // Without this call, Meta will not deliver any comment/message webhook events
  // for this account. This is the step that "turns on" the automation.
  // Idempotent — safe to call again if we're reconnecting an existing account.
  const sub = await subscribeAccountToWebhooks(
    instagramAccountId,
    longLived.access_token
  );
  if (!sub.ok) {
    console.error("[ig-oauth] webhook subscription failed:", sub.error);
    // Account is saved, but webhooks won't fire until we successfully subscribe.
    // Surface this to the user so they can retry via a "Reconnect" action.
    return dashboardRedirect(req, {
      ig_connected: "1",
      username,
      ig_warn: "subscription_failed",
      ig_error_desc: sub.error?.message || "Unknown subscription error",
    });
  }

  console.log(
    `[ig-oauth] subscribed @${username} (${instagramAccountId}) to webhook fields: ${sub.subscribed_fields?.join(",")}`
  );

  return dashboardRedirect(req, { ig_connected: "1", username });
}
