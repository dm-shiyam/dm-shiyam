#!/usr/bin/env node
/**
 * DM Shiyam — Spam Reply Cleanup
 *
 * Enumerates comments + nested replies on a given Instagram media (post/reel)
 * and deletes any authored by your own IG business account
 * (INSTAGRAM_ACCOUNT_ID). Useful after a self-reply loop incident.
 *
 * Usage:
 *   node scripts/cleanup-spam-replies.mjs <MEDIA_ID_OR_URL> [--dry-run] [--yes]
 *
 * Examples:
 *   node scripts/cleanup-spam-replies.mjs 18001234567890123 --dry-run
 *   node scripts/cleanup-spam-replies.mjs https://www.instagram.com/p/CxxxxYYY/ --yes
 *
 * If MEDIA_ID_OR_URL is omitted, the 10 most recent media items on the
 * connected account are listed so you can pick one.
 *
 * Flags:
 *   --dry-run   List the comments that would be deleted, but don't delete
 *   --yes       Skip the interactive confirmation prompt
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");

// ── Minimal .env.local loader (only vars we need) ──────────────────
function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error("❌ .env.local not found — run this from the project root");
    process.exit(1);
  }
  const text = fs.readFileSync(ENV_FILE, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv();
const TOKEN = env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = env.INSTAGRAM_ACCOUNT_ID;
const GRAPH = "https://graph.facebook.com/v21.0";

if (!TOKEN || !ACCOUNT_ID) {
  console.error("❌ INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_ACCOUNT_ID missing in .env.local");
  process.exit(1);
}

// ── Args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipConfirm = args.includes("--yes");
const positional = args.filter((a) => !a.startsWith("--"));
const mediaArg = positional[0];

// ── Helpers ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function graphGet(pathAndQuery) {
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  const url = `${GRAPH}${pathAndQuery}${sep}access_token=${TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  }
  return data;
}

async function graphDelete(id) {
  const res = await fetch(`${GRAPH}/${id}?access_token=${TOKEN}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  }
  return data;
}

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(q, (a) => { rl.close(); resolve(a.trim()); }));
}

// ── Media resolution ───────────────────────────────────────────────
async function listRecentMedia() {
  const data = await graphGet(`/${ACCOUNT_ID}/media?fields=id,caption,permalink,media_type,timestamp&limit=10`);
  return data.data ?? [];
}

async function resolveMediaId(input) {
  if (!input) return null;
  // If it looks like a numeric IG ID, use as-is
  if (/^\d+$/.test(input)) return input;
  // If a permalink URL like https://www.instagram.com/p/SHORTCODE/, look up via account media
  const media = await listRecentMedia();
  const found = media.find((m) => m.permalink && input.includes(m.permalink.replace(/\/$/, "")));
  if (found) return found.id;
  return null;
}

// ── Comment enumeration ────────────────────────────────────────────
async function fetchAllComments(mediaId) {
  const results = [];
  let next = `/${mediaId}/comments?fields=id,from,text,timestamp,replies{id,from,text,timestamp}&limit=50`;
  while (next) {
    const page = await graphGet(next);
    for (const c of page.data ?? []) {
      results.push(c);
      const nested = c.replies?.data ?? [];
      for (const r of nested) results.push(r);
    }
    const nextUrl = page.paging?.next;
    if (!nextUrl) break;
    // Convert full URL back to relative path
    const u = new URL(nextUrl);
    next = `${u.pathname.replace(/^\/v\d+\.\d+/, "")}${u.search}`;
    // Strip access_token from search to avoid duplication (graphGet re-adds)
    next = next.replace(/([?&])access_token=[^&]+&?/, "$1").replace(/[?&]$/, "");
    if (!next.includes("?")) next = next.replace(/&/, "?");
    await sleep(200);
  }
  return results;
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log("🔎 DM Shiyam — Spam Reply Cleanup");
  console.log(`   IG account: ${ACCOUNT_ID}`);
  console.log(`   Mode:       ${dryRun ? "DRY RUN (no deletions)" : "LIVE (will delete)"}\n`);

  let mediaId = await resolveMediaId(mediaArg);
  if (!mediaId) {
    console.log("No media specified — here are your 10 most recent posts:\n");
    const media = await listRecentMedia();
    if (media.length === 0) {
      console.error("❌ No media found on this account");
      process.exit(1);
    }
    media.forEach((m, i) => {
      const caption = (m.caption ?? "(no caption)").split("\n")[0].slice(0, 60);
      console.log(`  ${i + 1}. [${m.media_type}] ${m.id}`);
      console.log(`     ${m.timestamp}  ${m.permalink}`);
      console.log(`     ${caption}\n`);
    });
    const pick = await prompt("Enter the number (or full media ID) of the post to clean: ");
    const idx = parseInt(pick, 10);
    if (!isNaN(idx) && idx >= 1 && idx <= media.length) {
      mediaId = media[idx - 1].id;
    } else if (/^\d+$/.test(pick)) {
      mediaId = pick;
    } else {
      console.error("❌ Invalid selection");
      process.exit(1);
    }
  }

  console.log(`\n📥 Fetching comments on media ${mediaId}...`);
  const all = await fetchAllComments(mediaId);
  console.log(`   Found ${all.length} total comments/replies\n`);

  const selfAuthored = all.filter((c) => c.from?.id === ACCOUNT_ID);
  console.log(`🎯 Self-authored (by ${ACCOUNT_ID}): ${selfAuthored.length}\n`);

  if (selfAuthored.length === 0) {
    console.log("✅ Nothing to clean up.");
    return;
  }

  // Preview
  const preview = selfAuthored.slice(0, 10);
  preview.forEach((c, i) => {
    const text = (c.text ?? "").slice(0, 80).replace(/\n/g, " ");
    console.log(`   ${i + 1}. [${c.timestamp}] ${c.id} — "${text}"`);
  });
  if (selfAuthored.length > preview.length) {
    console.log(`   … and ${selfAuthored.length - preview.length} more`);
  }
  console.log("");

  if (dryRun) {
    console.log("🚫 DRY RUN — no deletions performed. Re-run without --dry-run to delete.");
    return;
  }

  if (!skipConfirm) {
    const answer = await prompt(`Delete these ${selfAuthored.length} comments? [y/N] `);
    if (answer.toLowerCase() !== "y") {
      console.log("Aborted.");
      return;
    }
  }

  let ok = 0;
  let fail = 0;
  const failures = [];
  for (const [i, c] of selfAuthored.entries()) {
    try {
      await graphDelete(c.id);
      ok++;
      process.stdout.write(`\r   Deleted ${ok}/${selfAuthored.length}`);
    } catch (err) {
      fail++;
      failures.push({ id: c.id, error: err.message });
    }
    // Gentle throttle — Meta rate limits comment deletes
    await sleep(500);
  }
  process.stdout.write("\n");

  console.log(`\n✅ Deleted: ${ok}`);
  if (fail > 0) {
    console.log(`❌ Failed:  ${fail}`);
    for (const f of failures.slice(0, 10)) {
      console.log(`   - ${f.id}: ${f.error}`);
    }
    if (failures.length > 10) console.log(`   … and ${failures.length - 10} more`);
  }
}

main().catch((err) => {
  console.error(`\n❌ Fatal: ${err.message}`);
  process.exit(1);
});
