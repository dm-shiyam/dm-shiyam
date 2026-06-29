// lib/token-manager.ts
// Handles Facebook/Instagram token lifecycle:
//   1. Exchange short-lived token (1hr) → long-lived token (60 days)
//   2. Refresh long-lived tokens before expiry
//   3. Persist expiry timestamps in DB

const GRAPH_API_VERSION = "v19.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface TokenExchangeResult {
  success: boolean;
  access_token?: string;
  token_type?: string;
  expires_in?: number; // seconds until expiry
  error?: string;
}

/**
 * Exchange a short-lived user token for a long-lived token (~60 days).
 * Requires APP_ID and APP_SECRET.
 *
 * Facebook docs: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<TokenExchangeResult> {
  try {
    const url = new URL(`${BASE_URL}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("fb_exchange_token", shortLivedToken);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok || data.error) {
      const errMsg = data.error?.message ?? `HTTP ${res.status}`;
      console.error("[token-manager] Exchange failed:", errMsg);
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in, // typically ~5184000 (60 days)
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[token-manager] Exchange error:", message);
    return { success: false, error: message };
  }
}

/**
 * Get a long-lived Page Access Token from a long-lived User Access Token.
 * Page tokens obtained this way do NOT expire (unless manually revoked).
 *
 * Flow: short-lived user token → long-lived user token → page token (never expires)
 */
export async function getPageAccessToken(
  longLivedUserToken: string,
  pageId: string
): Promise<TokenExchangeResult> {
  try {
    const url = `${BASE_URL}/${pageId}?fields=access_token&access_token=${longLivedUserToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      const errMsg = data.error?.message ?? `HTTP ${res.status}`;
      console.error("[token-manager] Page token fetch failed:", errMsg);
      return { success: false, error: errMsg };
    }

    // Page tokens derived from long-lived user tokens don't expire
    return {
      success: true,
      access_token: data.access_token,
      token_type: "page",
      expires_in: -1, // never expires
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[token-manager] Page token error:", message);
    return { success: false, error: message };
  }
}

/**
 * Refresh a long-lived token. Facebook long-lived tokens can be refreshed
 * once per day, and only if the token is at least 24 hours old and not yet expired.
 * The new token will have a fresh 60-day expiry.
 */
export async function refreshLongLivedToken(
  currentToken: string,
  appId: string,
  appSecret: string
): Promise<TokenExchangeResult> {
  // Refreshing uses the same endpoint as exchanging
  return exchangeForLongLivedToken(currentToken, appId, appSecret);
}

/**
 * Debug a token — returns info about expiry, scopes, validity.
 */
export async function debugToken(
  inputToken: string,
  appToken: string
): Promise<{
  is_valid: boolean;
  expires_at: number;
  scopes: string[];
  error?: string;
}> {
  try {
    const url = `${BASE_URL}/debug_token?input_token=${inputToken}&access_token=${appToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      return {
        is_valid: false,
        expires_at: 0,
        scopes: [],
        error: data.error?.message ?? `HTTP ${res.status}`,
      };
    }

    const info = data.data;
    return {
      is_valid: info.is_valid,
      expires_at: info.expires_at, // unix timestamp, 0 = never expires
      scopes: info.scopes ?? [],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { is_valid: false, expires_at: 0, scopes: [], error: message };
  }
}

/**
 * Check if a token is expiring soon (within the given threshold in seconds).
 * Default threshold: 7 days (604800 seconds).
 */
export function isTokenExpiringSoon(
  expiresAt: string | null,
  thresholdSeconds = 7 * 24 * 60 * 60
): boolean {
  if (!expiresAt) return true; // no expiry info → treat as expiring
  const expiryTime = new Date(expiresAt).getTime();
  if (expiryTime === 0) return false; // 0 = never expires (page tokens)
  const now = Date.now();
  return expiryTime - now < thresholdSeconds * 1000;
}

/**
 * Compute an ISO date string for when a token expires,
 * given expires_in in seconds from now.
 * Returns null if expires_in is -1 (never expires).
 */
export function computeExpiryDate(expiresIn: number): string | null {
  if (expiresIn <= 0) return null; // never expires
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}
