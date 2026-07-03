/**
 * Live webhook endpoint tests with proper HMAC signature.
 * 
 * Reads INSTAGRAM_APP_SECRET from .env.local and signs payloads correctly.
 * 
 * Run:  node tests/test-webhook-live.mjs
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// ─── Load APP_SECRET from .env.local ───────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  const env = {};
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

const env = loadEnv();
const APP_SECRET = env.INSTAGRAM_APP_SECRET;
const VERIFY_TOKEN = env.WEBHOOK_VERIFY_TOKEN;
const CRON_SECRET = env.CRON_SECRET;

if (!APP_SECRET) {
  console.error("❌ INSTAGRAM_APP_SECRET not found in .env.local");
  process.exit(1);
}

console.log(`Using APP_SECRET: ****${APP_SECRET.slice(-4)}`);
console.log(`Base URL: ${BASE_URL}\n`);

// ─── Helpers ───────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ ${label}`); }
}

function sign(body) {
  return "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(body).digest("hex");
}

async function postWebhook(payload, { signature, extraHeaders } = {}) {
  const body = JSON.stringify(payload);
  const sig = signature ?? sign(body);
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (sig) headers["X-Hub-Signature-256"] = sig;
  const res = await fetch(`${BASE_URL}/api/webhook/instagram`, { method: "POST", headers, body });
  return { status: res.status, body: await res.text() };
}

// ═══════════════════════════════════════════════════════════════════
// TEST 1: Webhook GET Verification Handshake
// ═══════════════════════════════════════════════════════════════════
console.log("══════════════════════════════════════════");
console.log("TEST 1: GET Verification Handshake");
console.log("══════════════════════════════════════════\n");

{
  // Correct token
  const res = await fetch(`${BASE_URL}/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=challenge_abc`);
  assert(res.status === 200, `Correct token → 200 (got ${res.status})`);
  const text = await res.text();
  assert(text === "challenge_abc", `Returns challenge string (got "${text}")`);
}
{
  // Wrong token
  const res = await fetch(`${BASE_URL}/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x`);
  assert(res.status === 403, `Wrong token → 403 (got ${res.status})`);
}

// ═══════════════════════════════════════════════════════════════════
// TEST 2: Signature Verification
// ═══════════════════════════════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log("TEST 2: Signature Verification");
console.log("══════════════════════════════════════════\n");

{
  // Valid signature
  const r = await postWebhook({ object: "instagram", entry: [] });
  assert(r.status === 200, `Valid signature → 200 (got ${r.status})`);
}
{
  // Invalid signature
  const r = await postWebhook({ object: "instagram", entry: [] }, { signature: "sha256=0000000000000000000000000000000000000000000000000000000000000000" });
  assert(r.status === 403, `Invalid signature → 403 (got ${r.status})`);
}
{
  // Missing header
  const body = JSON.stringify({ object: "instagram", entry: [] });
  const res = await fetch(`${BASE_URL}/api/webhook/instagram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  assert(res.status === 403, `Missing signature header → 403 (got ${res.status})`);
}
{
  // Wrong length signature
  const r = await postWebhook({ object: "instagram", entry: [] }, { signature: "sha256=abc" });
  assert(r.status === 403, `Short signature → 403 (got ${r.status})`);
}

// ═══════════════════════════════════════════════════════════════════
// TEST 3: Webhook processes valid signed payload
// ═══════════════════════════════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log("TEST 3: Valid Signed Payload Processing");
console.log("══════════════════════════════════════════\n");

{
  // Valid payload with comment (will fail at Instagram API level, but webhook should accept it)
  const payload = {
    object: "instagram",
    entry: [{
      id: "12345",
      changes: [{
        field: "comments",
        value: {
          from: { id: "999888777", username: "test_commenter" },
          text: "I want info please",
          id: "comment_real_id_456",
          media: { id: "media_123" },
        },
      }],
    }],
  };
  const r = await postWebhook(payload);
  assert(r.status === 200, `Signed comment payload → 200 (got ${r.status})`);
  assert(r.body === "EVENT_RECEIVED", `Response body is EVENT_RECEIVED (got "${r.body}")`);
}

// ═══════════════════════════════════════════════════════════════════
// TEST 4: Empty entry array (no crash)
// ═══════════════════════════════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log("TEST 4: Edge Cases");
console.log("══════════════════════════════════════════\n");

{
  const r = await postWebhook({ object: "instagram", entry: [] });
  assert(r.status === 200, `Empty entry array → 200 (got ${r.status})`);
}
{
  const r = await postWebhook({ object: "instagram" });
  assert(r.status === 200, `Missing entry key → 200 (got ${r.status})`);
}
{
  // Non-comment field should be ignored
  const payload = {
    object: "instagram",
    entry: [{ id: "1", changes: [{ field: "mentions", value: {} }] }],
  };
  const r = await postWebhook(payload);
  assert(r.status === 200, `Non-comment field ignored → 200 (got ${r.status})`);
}

// ═══════════════════════════════════════════════════════════════════
// TEST 5: Cron DM Reset Auth
// ═══════════════════════════════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log("TEST 5: Cron DM Reset Auth");
console.log("══════════════════════════════════════════\n");

{
  const r = await fetch(`${BASE_URL}/api/cron/reset-dm-usage`);
  assert(r.status === 401, `No secret → 401 (got ${r.status})`);
}
{
  const r = await fetch(`${BASE_URL}/api/cron/reset-dm-usage?secret=wrong`);
  assert(r.status === 401, `Wrong secret → 401 (got ${r.status})`);
}
if (CRON_SECRET) {
  const r = await fetch(`${BASE_URL}/api/cron/reset-dm-usage?secret=${CRON_SECRET}`);
  assert(r.status === 200, `Correct secret → 200 (got ${r.status})`);
  const data = await r.json();
  assert(data.message !== undefined, `Response has message field`);
}

// ═══════════════════════════════════════════════════════════════════
// TEST 6: Analytics Auth Guard
// ═══════════════════════════════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log("TEST 6: Analytics Auth Guard");
console.log("══════════════════════════════════════════\n");

{
  const r = await fetch(`${BASE_URL}/api/analytics?days=7`);
  assert(r.status === 401, `No session → 401 (got ${r.status})`);
}
{
  const r = await fetch(`${BASE_URL}/api/analytics?days=-5`);
  assert(r.status === 401, `Negative days (no auth) → 401 (got ${r.status})`);
}

// ═══════════════════════════════════════════════════════════════════
// TEST 7: Webhook Health
// ═══════════════════════════════════════════════════════════════════
console.log("\n══════════════════════════════════════════");
console.log("TEST 7: Webhook Health");
console.log("══════════════════════════════════════════\n");

{
  const r = await fetch(`${BASE_URL}/api/webhook/health`);
  // Should require auth
  assert(r.status === 401 || r.status === 200, `Health endpoint responds (got ${r.status})`);
}

// ═══════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════");
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("══════════════════════════════════════════\n");

process.exit(failed > 0 ? 1 : 0);
