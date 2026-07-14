// lib/oauth-state.ts
// HMAC-signed OAuth state parameter for CSRF protection.
// Binds the OAuth flow to a specific logged-in user + short-lived nonce.

import crypto from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error(
      "NEXTAUTH_SECRET (or OAUTH_STATE_SECRET) must be set to sign OAuth state"
    );
  }
  return secret;
}

interface StatePayload {
  u: string; // userId
  n: string; // nonce
  t: number; // timestamp ms
}

export function signState(userId: string): string {
  const payload: StatePayload = {
    u: userId,
    n: crypto.randomBytes(16).toString("hex"),
    t: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string):
  | { ok: true; userId: string }
  | { ok: false; reason: string } {
  if (!state || typeof state !== "string" || !state.includes(".")) {
    return { ok: false, reason: "malformed" };
  }
  const [body, sig] = state.split(".");
  if (!body || !sig) return { ok: false, reason: "malformed" };

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");

  // Timing-safe comparison
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "unparseable" };
  }

  if (!payload.u || !payload.t || Date.now() - payload.t > STATE_TTL_MS) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, userId: payload.u };
}
