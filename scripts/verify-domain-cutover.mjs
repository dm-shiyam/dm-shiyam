#!/usr/bin/env node
// scripts/verify-domain-cutover.mjs
// V9 — Post-cutover smoke check.
//
// Run this after every step of V9 so a bad config surfaces in 30 seconds
// instead of via a user report the next morning.
//
// USAGE:
//   node scripts/verify-domain-cutover.mjs                       # checks dmshiyam.com
//   DOMAIN=https://dm-shiyam.vercel.app node scripts/... # or any custom host
//
// EXIT CODES:
//   0  all critical checks pass (SSL + health + webhooks)
//   1  a critical check failed — do NOT proceed with cutover
//   2  a non-critical check failed (warn only, still safe to launch)

import { readFileSync, existsSync } from "node:fs";

// ── Env / .env.local ──────────────────────────────────────────────────────
if (existsSync(".env.local")) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const DOMAIN = (process.env.DOMAIN || "https://dmshiyam.com").replace(/\/$/, "");
const WWW_DOMAIN = DOMAIN.replace("://", "://www.");

const c = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", b: "\x1b[36m", x: "\x1b[0m" };
let criticalFails = 0;
let warnings = 0;

const h = (m) => console.log(`\n${c.b}━━ ${m}${c.x}`);
const pass = (m) => console.log(`  ${c.g}✓${c.x} ${m}`);
const warn = (m, why) => {
  warnings++;
  console.log(`  ${c.y}!${c.x} ${m} ${c.y}(${why})${c.x}`);
};
const fail = (m, why) => {
  criticalFails++;
  console.log(`  ${c.r}✗${c.x} ${m} ${c.r}(${why})${c.x}`);
};

async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal, redirect: "manual" });
  } finally {
    clearTimeout(t);
  }
}

// ─────────────────────────────────────────────────────────────────────────
console.log(`${c.b}▶ V9 Domain Cutover Verifier${c.x}`);
console.log(`  target: ${DOMAIN}\n`);

// 1) SSL + root reachable
h("1) SSL + root page");
{
  try {
    const res = await fetchWithTimeout(DOMAIN + "/");
    if (res.status >= 200 && res.status < 400) pass(`GET / → ${res.status}`);
    else fail(`GET / → ${res.status}`, "expected 2xx/3xx");
  } catch (err) {
    fail("GET /", err?.name === "AbortError" ? "timeout after 8s" : String(err?.message ?? err));
  }
}

// 2) www redirect
h("2) www → apex redirect");
try {
  const res = await fetchWithTimeout(WWW_DOMAIN + "/");
  if (res.status === 301 || res.status === 308) {
    const loc = res.headers.get("location") || "";
    if (loc.startsWith(DOMAIN)) pass(`www redirects to apex (${res.status})`);
    else warn(`www redirects (${res.status})`, `location=${loc || "missing"}`);
  } else if (res.status === 200) {
    warn("www returns 200", "expected 301/308 redirect to apex");
  } else {
    warn(`www returned ${res.status}`, "expected 301/308");
  }
} catch (err) {
  warn("www redirect check", err?.message ?? String(err));
}

// 3) Health check (V21 endpoint)
h("3) /api/health");
try {
  const res = await fetchWithTimeout(DOMAIN + "/api/health");
  const body = await res.json().catch(() => null);
  if (res.status === 200 && body?.status === "ok") pass("/api/health → 200 { status: ok }");
  else if (res.status === 503) fail("/api/health", `503 — dependency down: ${JSON.stringify(body)}`);
  else fail("/api/health", `unexpected: status=${res.status} body=${JSON.stringify(body)}`);
} catch (err) {
  fail("/api/health", err?.message ?? String(err));
}

// 4) Meta webhook verification (GET, hub.challenge echo)
//    Uses WEBHOOK_VERIFY_TOKEN if we have it; otherwise validates the
//    endpoint at least returns a 400/403 for bad tokens (proves it's live).
h("4) Meta webhook verification (GET)");
{
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || "";
  const challenge = "verify-test-" + Date.now();
  const q =
    `?hub.mode=subscribe` +
    `&hub.verify_token=${encodeURIComponent(verifyToken)}` +
    `&hub.challenge=${encodeURIComponent(challenge)}`;
  try {
    const res = await fetchWithTimeout(DOMAIN + "/api/webhook/instagram" + q);
    const text = await res.text();
    if (verifyToken) {
      if (res.status === 200 && text.trim() === challenge)
        pass("GET verify → 200 echoes hub.challenge");
      else fail("GET verify", `status=${res.status} body=${text.slice(0, 80)}`);
    } else {
      // Without token, at least prove the route exists (any 2xx/4xx is fine)
      if (res.status < 500) pass(`route reachable → ${res.status} (skipped challenge — WEBHOOK_VERIFY_TOKEN not in local env)`);
      else fail("Meta webhook", `status=${res.status}`);
    }
  } catch (err) {
    fail("Meta webhook", err?.message ?? String(err));
  }
}

// 5) Razorpay webhook — POST with wrong signature must be rejected (400)
h("5) Razorpay webhook signature enforcement");
try {
  const res = await fetchWithTimeout(DOMAIN + "/api/billing/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": "0".repeat(64),
    },
    body: JSON.stringify({ event: "ping", payload: {} }),
  });
  if (res.status === 400) pass("bad signature → 400 (fail-closed as expected)");
  else fail("Razorpay signature enforcement", `expected 400, got ${res.status}`);
} catch (err) {
  fail("Razorpay webhook", err?.message ?? String(err));
}

// 6) NextAuth callback URL surface — /api/auth/providers should list configured providers
h("6) NextAuth providers reachable");
try {
  const res = await fetchWithTimeout(DOMAIN + "/api/auth/providers");
  if (res.status === 200) {
    const body = await res.json().catch(() => ({}));
    const keys = Object.keys(body || {});
    if (keys.length > 0) pass(`providers: ${keys.join(", ")}`);
    else warn("providers list empty", "credentials + google should appear");
  } else {
    fail("/api/auth/providers", `status=${res.status}`);
  }
} catch (err) {
  fail("/api/auth/providers", err?.message ?? String(err));
}

// 7) IG OAuth authorize endpoint — the route is auth-gated, so an
//    unauthenticated request should redirect to /login. That's proof enough
//    that the route exists and env vars aren't causing a 500.
//    A 302 straight to facebook.com/instagram.com is even better (would
//    only happen if we had a valid session cookie, which we don't here).
h("7) Instagram OAuth authorize reachable");
try {
  const res = await fetchWithTimeout(DOMAIN + "/api/instagram/oauth/authorize");
  const loc = res.headers.get("location") || "";
  if (res.status === 302 || res.status === 307) {
    if (loc.includes("facebook.com") || loc.includes("instagram.com")) {
      pass(`302 → ${new URL(loc).hostname} (authenticated path)`);
      try {
        const redir = new URL(loc).searchParams.get("redirect_uri") ?? "";
        if (redir.startsWith(DOMAIN))
          pass(`redirect_uri points back to ${DOMAIN} (Meta whitelist must match)`);
        else
          warn(
            "redirect_uri mismatch",
            `Meta app must whitelist: ${redir || "(missing)"}`,
          );
      } catch {
        /* URL parse issue — non-fatal */
      }
    } else if (loc.includes("/login")) {
      pass(`302 → /login (auth-gated route reachable; log in to test Meta redirect)`);
    } else {
      warn("IG authorize redirect", `unexpected location: ${loc}`);
    }
  } else if (res.status === 401 || res.status === 403) {
    pass(`${res.status} — auth-gated route reachable (log in to test Meta redirect)`);
  } else if (res.status === 500) {
    fail(
      "IG authorize",
      "500 — INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET likely missing in env",
    );
  } else {
    warn("IG authorize", `unexpected status ${res.status}`);
  }
} catch (err) {
  fail("IG authorize", err?.message ?? String(err));
}

// 8) Sitemap + robots (SEO — non-critical but worth catching)
h("8) SEO surface");
for (const p of ["/sitemap.xml", "/robots.txt"]) {
  try {
    const res = await fetchWithTimeout(DOMAIN + p);
    if (res.status === 200) pass(`GET ${p} → 200`);
    else warn(`GET ${p}`, `status=${res.status}`);
  } catch (err) {
    warn(`GET ${p}`, err?.message ?? String(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────
console.log("");
if (criticalFails > 0) {
  console.log(`${c.r}❌ ${criticalFails} critical failure(s), ${warnings} warning(s) — DO NOT cutover${c.x}\n`);
  process.exit(1);
}
if (warnings > 0) {
  console.log(`${c.y}⚠  0 critical, ${warnings} warning(s) — safe to launch, fix warnings ASAP${c.x}\n`);
  process.exit(2);
}
console.log(`${c.g}✅ All checks passed — cutover looks healthy${c.x}\n`);
process.exit(0);
