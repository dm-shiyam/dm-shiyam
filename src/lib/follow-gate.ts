// src/lib/follow-gate.ts
// V29 — Follow-to-Unlock helpers.
//
// Encodes/decodes the postback payload we attach to the "I followed ✅"
// quick-reply button. The payload contains the pending_follow_gates.id and
// an HMAC signature so that a malicious IG user CAN'T craft a postback that
// unlocks an arbitrary DM to themselves (or worse, to another fan).
//
// Payload wire format:
//   FGATE:<gate_id>:<hmac_hex>
//
// - gate_id is a UUIDv4 (36 chars) — the primary key of pending_follow_gates
// - hmac_hex is the first 16 hex chars of HMAC-SHA256(secret, gate_id)
//   Truncated to keep the payload under Meta's ~1000-char postback limit
//   with plenty of headroom. 16 hex chars = 64 bits — plenty for our attack
//   model (no incentive to brute-force a single unlock).
//
// Secret source:
//   FOLLOW_GATE_SECRET env var. Falls back to NEXTAUTH_SECRET if unset so
//   that new deploys don't crash before an ops person sets it. In prod we
//   want a dedicated secret so rotating NextAuth doesn't invalidate every
//   in-flight gate.
//
// NOTE: The postback receipt is idempotent (see claimPendingFollowGate — it
// only fires on state='pending'). So a replay of a valid old postback CAN'T
// double-send. HMAC is defense-in-depth against payload forgery, not the
// primary safety net.

import { createHmac, timingSafeEqual } from "crypto";

const PAYLOAD_PREFIX = "FGATE:";
const HMAC_HEX_LENGTH = 16; // 64 bits — see comment above

function getSecret(): string {
  const s = process.env.FOLLOW_GATE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) {
    // We choose to throw here rather than falling back to a hard-coded
    // string. A silent fallback would ship a signing key to everyone who
    // clones the repo — much worse than a loud crash the first time the
    // webhook tries to send a gated DM.
    throw new Error(
      "[follow-gate] FOLLOW_GATE_SECRET (or NEXTAUTH_SECRET fallback) is not set"
    );
  }
  return s;
}

function sign(gateId: string): string {
  return createHmac("sha256", getSecret())
    .update(gateId)
    .digest("hex")
    .slice(0, HMAC_HEX_LENGTH);
}

export function encodePostbackPayload(gateId: string): string {
  return `${PAYLOAD_PREFIX}${gateId}:${sign(gateId)}`;
}

/**
 * Decode a postback payload and validate the HMAC. Returns the gate_id on
 * success or null on any tampering / malformation. Never throws — the
 * webhook path calls this on untrusted input.
 */
export function decodePostbackPayload(raw: string | undefined): { gateId: string } | null {
  if (!raw || !raw.startsWith(PAYLOAD_PREFIX)) return null;
  const parts = raw.slice(PAYLOAD_PREFIX.length).split(":");
  if (parts.length !== 2) return null;
  const [gateId, sigHex] = parts;
  if (!gateId || !sigHex || sigHex.length !== HMAC_HEX_LENGTH) return null;

  // Recompute + timing-safe compare so we don't leak byte-level equality
  // over side channels. Both sides must be the same length or timingSafeEqual
  // throws; the length check above guarantees that.
  let expected: string;
  try {
    expected = sign(gateId);
  } catch {
    // Missing secret — fail closed rather than accepting the payload.
    return null;
  }
  const a = Buffer.from(sigHex, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return { gateId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Message personalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Personalize the follow-gate DM message. Supports two placeholders:
 *   {username} → @<fan's IG handle>   (e.g. @some_fan)
 *   {account}  → @<creator's handle>  (e.g. @dm_shiyam) — the account
 *                the fan is being asked to follow.
 *
 * Kept separate from personalizeMessage() in instagram.ts because that
 * one only knows about {username}. Follow-gate messages critically need
 * {account} so the creator can say "Follow @dm_shiyam first" without
 * hard-coding their own handle in the template.
 */
export function personalizeFollowGateMessage(
  template: string,
  fanUsername: string,
  accountUsername: string
): string {
  return template
    .replace(/\{username\}/gi, `@${fanUsername}`)
    .replace(/\{account\}/gi, `@${accountUsername}`);
}

/**
 * Default gate DM used when the automation doesn't have a custom
 * follow_gate_message set. Kept here (not in the DB default) so we can
 * evolve the copy without a migration.
 */
export const DEFAULT_GATE_MESSAGE =
  "Hey {username}! 👋 Follow {account} first, then tap the button below and I'll send you what you asked for 👇";

export const GATE_BUTTON_TITLE = "I followed ✅";
