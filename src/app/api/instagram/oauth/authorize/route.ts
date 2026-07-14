// GET /api/instagram/oauth/authorize
// Starts the Instagram Business Login OAuth flow.
// The user must be logged in; we sign the userId into `state` so the
// callback can trust which DM Shiyam account to bind the IG account to.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { signState } from "@/lib/oauth-state";

const IG_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";

// Scopes for Instagram API with Instagram Login (new flow, 2024+).
// These MUST match what is submitted for App Review.
const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");

function getRedirectUri(req: NextRequest): string {
  // Prefer explicit env var (must match what is registered in Meta App Dashboard).
  const explicit = process.env.INSTAGRAM_REDIRECT_URI;
  if (explicit) return explicit;

  // Fall back to computing from the incoming request. Vercel sets x-forwarded-proto correctly.
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");
  return `${proto}://${host}/api/instagram/oauth/callback`;
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    // Bounce them to login and come back here after
    const back = new URL("/login", req.url);
    back.searchParams.set("callbackUrl", "/api/instagram/oauth/authorize");
    return NextResponse.redirect(back);
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID is not configured" },
      { status: 500 }
    );
  }

  const state = signState(userId);
  const redirectUri = getRedirectUri(req);

  const url = new URL(IG_AUTHORIZE_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  // Force the OAuth screen every time so reviewers can see the consent flow
  url.searchParams.set("force_authentication", "1");

  return NextResponse.redirect(url.toString(), { status: 302 });
}
