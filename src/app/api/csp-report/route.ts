// POST /api/csp-report — receives Content-Security-Policy violation reports
// from the browser and forwards them to Sentry + Vercel logs.
//
// While CSP is in Report-Only mode (see next.config.js), this endpoint is our
// only signal that a legitimate third-party is missing from the allowlist.
// Once the allowlist is stable and we flip CSP_ENFORCE=1, violations here
// become genuine attack indicators.
//
// Browsers send reports in one of two formats:
//   1. Legacy  → Content-Type: application/csp-report   → body: { "csp-report": {...} }
//   2. Modern  → Content-Type: application/reports+json → body: [{ type, body, ... }]
// We handle both.

import { NextRequest, NextResponse } from "next/server";
import { captureAlert } from "@/lib/monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Very cheap in-memory throttle so a misbehaving page can't spam Sentry.
// Keyed by "blocked-uri + violated-directive" — same violation from the same
// origin at most once per THROTTLE_WINDOW_MS across a single serverless
// instance. Not perfect (multiple instances = multiple reports) but good
// enough to prevent runaway cost.
const THROTTLE_WINDOW_MS = 60_000;
const recentReports = new Map<string, number>();

function shouldForward(key: string): boolean {
  const now = Date.now();
  const last = recentReports.get(key);
  if (last && now - last < THROTTLE_WINDOW_MS) return false;
  recentReports.set(key, now);
  // Prevent unbounded map growth on a long-lived instance
  if (recentReports.size > 500) {
    for (const [k, ts] of recentReports) {
      if (now - ts > THROTTLE_WINDOW_MS) recentReports.delete(k);
    }
  }
  return true;
}

interface NormalizedReport {
  blocked_uri: string;
  violated_directive: string;
  document_uri: string;
  source_file?: string;
  line_number?: number;
  disposition?: string;
}

function normalizeLegacy(body: unknown): NormalizedReport | null {
  if (!body || typeof body !== "object") return null;
  const r = (body as { "csp-report"?: Record<string, unknown> })["csp-report"];
  if (!r) return null;
  return {
    blocked_uri: String(r["blocked-uri"] ?? "unknown"),
    violated_directive: String(r["violated-directive"] ?? "unknown"),
    document_uri: String(r["document-uri"] ?? "unknown"),
    source_file: r["source-file"] ? String(r["source-file"]) : undefined,
    line_number:
      typeof r["line-number"] === "number" ? (r["line-number"] as number) : undefined,
    disposition: r["disposition"] ? String(r["disposition"]) : undefined,
  };
}

function normalizeModern(body: unknown): NormalizedReport[] {
  if (!Array.isArray(body)) return [];
  const out: NormalizedReport[] = [];
  for (const entry of body) {
    if (!entry || entry.type !== "csp-violation" || !entry.body) continue;
    const b = entry.body as Record<string, unknown>;
    out.push({
      blocked_uri: String(b.blockedURL ?? "unknown"),
      violated_directive: String(b.effectiveDirective ?? b.violatedDirective ?? "unknown"),
      document_uri: String(b.documentURL ?? "unknown"),
      source_file: b.sourceFile ? String(b.sourceFile) : undefined,
      line_number: typeof b.lineNumber === "number" ? (b.lineNumber as number) : undefined,
      disposition: b.disposition ? String(b.disposition) : undefined,
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // Malformed report — silently accept, don't crash on garbage input.
    return new NextResponse(null, { status: 204 });
  }

  const contentType = req.headers.get("content-type") || "";
  const reports = contentType.includes("application/reports+json")
    ? normalizeModern(body)
    : ([normalizeLegacy(body)].filter(Boolean) as NormalizedReport[]);

  for (const r of reports) {
    const key = `${r.violated_directive}::${r.blocked_uri}`;
    if (!shouldForward(key)) continue;

    // Log to Vercel — grep-able even before Sentry is live
    console.warn("[csp-report]", JSON.stringify(r));

    // Forward to Sentry as an alert (warning-level). Includes context so we
    // can tell whether it's a real violation or a missing allowlist entry.
    captureAlert("CSP violation", {
      directive: r.violated_directive,
      blocked_uri: r.blocked_uri,
      document_uri: r.document_uri,
      source_file: r.source_file ?? null,
      line_number: r.line_number ?? null,
      disposition: r.disposition ?? "report",
    });
  }

  // Browsers ignore the response body for CSP reports — 204 is the convention.
  return new NextResponse(null, { status: 204 });
}
