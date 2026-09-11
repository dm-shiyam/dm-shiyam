// GET /api/analytics/export?days=30&format=csv
//
// Business/Agency-tier analytics export. Returns a CSV bundle covering the
// four charts shown on /dashboard → Analytics: daily DM counts, hourly
// distribution, top keywords, and per-account breakdown. Downloaded via
// the "Export CSV" button in AnalyticsTab.tsx.
//
// Auth model:
//   * Requires a valid session (401 otherwise).
//   * Requires the user's plan to be in EXPORT_ENABLED_PLANS
//     (403 otherwise) — matches the client-side gating in AnalyticsTab.tsx.
//     Server-side enforcement is the security check; the client hide is UX.
//
// Format:
//   The CSV is a single file with four sections separated by blank lines.
//   Excel + Google Sheets both open this cleanly and each section is easily
//   promotable to its own sheet with a Split action. If we later add JSON
//   export (?format=json) that path returns the raw AnalyticsData object.

import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsData, getUserById } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const EXPORT_ENABLED_PLANS = new Set(["business", "agency"]);

// RFC 4180-lite CSV escape. Wraps a cell in quotes only when it contains a
// comma, quote, or newline, and escapes internal quotes by doubling them.
function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(",");
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Plan gate — the whole reason this endpoint is separate from
    // /api/analytics is that we sell "reporting/export" as a Business+ tier.
    // Do NOT lift this check into a middleware — we want a clear 403 with a
    // helpful message so support tickets are easy to triage.
    const user = await getUserById(userId);
    if (!user || !EXPORT_ENABLED_PLANS.has(user.plan)) {
      return NextResponse.json(
        {
          error: "CSV export is a Business+ feature",
          upgrade_url: "/pricing",
          current_plan: user?.plan ?? "unknown",
        },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const rawDays = Number(url.searchParams.get("days"));
    const days = Number.isFinite(rawDays)
      ? Math.max(1, Math.min(365, Math.floor(rawDays)))
      : 30;
    const format = (url.searchParams.get("format") || "csv").toLowerCase();

    const data = await getAnalyticsData(days, userId);

    // ?format=json — same payload as /api/analytics, kept here so power
    // users can hit a single "export" URL for both CSV + JSON downloads.
    if (format === "json") {
      const filename = `dmshiyam-analytics-${days}d-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      return new NextResponse(JSON.stringify(data, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Build the CSV — four sections separated by blank lines. Column headers
    // repeat per section so each block is self-describing when copied into a
    // separate sheet.
    const lines: string[] = [];

    lines.push(
      `# DM Shiyam Analytics Export | window: last ${days} days | generated: ${new Date().toISOString()}`
    );
    lines.push("");

    // Section 1 — DMs over time (daily)
    lines.push("# 1. DMs Sent Over Time (daily)");
    lines.push(csvRow(["date", "total_dms", "ai_generated"]));
    for (const row of data.dms_over_time) {
      lines.push(csvRow([row.date, row.count, row.ai_count]));
    }
    lines.push("");

    // Section 2 — Top keywords
    lines.push("# 2. Top Keywords");
    lines.push(csvRow(["keyword", "trigger_count"]));
    for (const row of data.top_keywords) {
      lines.push(csvRow([row.keyword, row.count]));
    }
    lines.push("");

    // Section 3 — Hourly distribution (UTC)
    lines.push("# 3. Activity by Hour of Day (UTC)");
    lines.push(csvRow(["hour_utc", "dms_sent"]));
    for (const row of data.hourly_distribution) {
      lines.push(csvRow([row.hour, row.count]));
    }
    lines.push("");

    // Section 4 — Per-account breakdown
    lines.push("# 4. DMs by Instagram Account");
    lines.push(csvRow(["account_id", "instagram_username", "dms_sent"]));
    for (const row of data.per_account) {
      lines.push(csvRow([row.account_id, row.username, row.count]));
    }
    lines.push("");

    // Section 5 — Delivery success summary
    lines.push("# 5. Delivery Success Summary");
    lines.push(csvRow(["metric", "value"]));
    lines.push(csvRow(["dms_sent", data.success_rate.sent]));
    lines.push(csvRow(["dms_failed", data.success_rate.failed]));
    const total = data.success_rate.sent + data.success_rate.failed;
    lines.push(
      csvRow([
        "success_rate_pct",
        total === 0 ? 0 : ((data.success_rate.sent / total) * 100).toFixed(2),
      ])
    );

    const csv = lines.join("\r\n") + "\r\n";
    const filename = `dmshiyam-analytics-${days}d-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Prevent caching so a user changing the days=/format= gets fresh data
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[analytics/export] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
