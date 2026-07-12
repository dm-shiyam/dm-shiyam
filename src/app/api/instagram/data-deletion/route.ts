/**
 * Meta Data Deletion Request callback
 *
 * Registered in Meta App Dashboard → App Settings → Basic → User Data Deletion.
 * Meta POSTs here whenever a user requests deletion of their Platform Data.
 *
 * Request format (application/x-www-form-urlencoded):
 *   signed_request=<base64url_hmac>.<base64url_json_payload>
 *
 * Payload contains: { user_id, algorithm, issued_at, expires, ... }
 * For Business Login for Instagram, `user_id` === accounts.instagram_account_id.
 *
 * Response (required by Meta):
 *   200 OK + JSON: { url: <status_page>, confirmation_code: <opaque_code> }
 *
 * Reference: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { processInstagramDataDeletion } from "@/lib/db";

const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || "";
const APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || "";

interface SignedRequestPayload {
  user_id?: string;
  algorithm?: string;
  issued_at?: number;
  expires?: number;
}

/**
 * Verify and decode Meta's signed_request per
 * https://developers.facebook.com/docs/facebook-login/guides/advanced/signed-request
 * Uses HMAC-SHA256 with the app secret. Timing-safe comparison prevents
 * length/content leak via response-time analysis.
 */
function parseSignedRequest(signedRequest: string): SignedRequestPayload | null {
  if (!signedRequest || !APP_SECRET) return null;

  const parts = signedRequest.split(".");
  if (parts.length !== 2) return null;

  const [encodedSig, payload] = parts;
  let expectedSigBuf: Buffer;
  let receivedSigBuf: Buffer;
  try {
    expectedSigBuf = crypto
      .createHmac("sha256", APP_SECRET)
      .update(payload)
      .digest();
    receivedSigBuf = Buffer.from(encodedSig, "base64url");
  } catch {
    return null;
  }

  if (
    expectedSigBuf.length !== receivedSigBuf.length ||
    !crypto.timingSafeEqual(expectedSigBuf, receivedSigBuf)
  ) {
    return null;
  }

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as SignedRequestPayload;
    if (parsed.algorithm && parsed.algorithm !== "HMAC-SHA256") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Fail closed in production if the app secret isn't set — the alternative
  // (skipping verification) would let anyone trigger deletions.
  if (!APP_SECRET) {
    console.error("[data-deletion] INSTAGRAM_APP_SECRET not configured");
    return NextResponse.json(
      { error: "server misconfigured" },
      { status: 500 }
    );
  }

  // Meta sends form-encoded body. Parse defensively — some clients (and
  // certain testing tools) send JSON.
  let signedRequest = "";
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { signed_request?: string };
      signedRequest = body.signed_request ?? "";
    } else {
      const form = await req.formData();
      const val = form.get("signed_request");
      signedRequest = typeof val === "string" ? val : "";
    }
  } catch (err) {
    console.error("[data-deletion] Failed to parse body:", err);
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!signedRequest) {
    return NextResponse.json(
      { error: "signed_request missing" },
      { status: 400 }
    );
  }

  const payload = parseSignedRequest(signedRequest);
  if (!payload) {
    console.warn("[data-deletion] Signature verification failed");
    return NextResponse.json(
      { error: "invalid signature" },
      { status: 401 }
    );
  }

  const igUserId = payload.user_id;
  if (!igUserId) {
    console.warn("[data-deletion] Payload missing user_id:", payload);
    return NextResponse.json(
      { error: "user_id missing" },
      { status: 400 }
    );
  }

  // Confirmation code is a short URL-safe UUID. Meta will show this to the
  // user and use it in the status URL — must be opaque and unguessable.
  const confirmationCode = uuidv4().replace(/-/g, "").slice(0, 24);

  try {
    const result = await processInstagramDataDeletion(igUserId, confirmationCode);
    console.log(
      `[data-deletion] Processed request for IG user ${igUserId}: ` +
        `status=${result.status}, ` +
        `automations=${result.automations_deleted}, ` +
        `activity=${result.activity_rows_deleted}, ` +
        `code=${confirmationCode}`
    );
  } catch (err) {
    console.error(
      `[data-deletion] Processing failed for IG user ${igUserId}:`,
      err
    );
    // Still return the confirmation URL so Meta records the callback.
    // The status page will show "pending" for this code, which is honest.
  }

  const origin = APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const statusUrl = `${origin.replace(/\/$/, "")}/deletion-status/${confirmationCode}`;

  return NextResponse.json({
    url: statusUrl,
    confirmation_code: confirmationCode,
  });
}

// Meta occasionally sends a GET during URL validation. Return a benign 200.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: "Instagram Data Deletion Request callback",
    method: "POST",
    docs: "https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback",
  });
}
