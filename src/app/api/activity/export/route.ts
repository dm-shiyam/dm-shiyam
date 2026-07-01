import { NextRequest, NextResponse } from "next/server";
import { getActivityLog } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";
  const limit = Math.min(parseInt(searchParams.get("limit") || "5000", 10), 10000);

  const activities = getActivityLog(limit, 0, { userId });

  if (format === "csv") {
    const headers = [
      "id",
      "created_at",
      "automation_name",
      "instagram_username",
      "comment_text",
      "matched_keyword",
      "dm_sent",
      "comment_replied",
      "ai_generated",
      "error_message",
    ];

    const escape = (val: unknown) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = activities.map((a) =>
      [
        a.id,
        a.created_at,
        a.automation_name,
        a.instagram_username,
        a.comment_text,
        a.matched_keyword,
        a.dm_sent ? "yes" : "no",
        a.comment_replied ? "yes" : "no",
        a.ai_generated ? "yes" : "no",
        a.error_message ?? "",
      ]
        .map(escape)
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `activity-log-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format. Use ?format=csv" }, { status: 400 });
}
