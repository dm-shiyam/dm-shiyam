// import { NextRequest, NextResponse } from "next/server";
// import { getAnalyticsData } from "@/lib/db";
// import { getSessionUserId } from "@/lib/session";

// export async function GET(req: NextRequest) {
//   try {
//     const userId = await getSessionUserId();
//     if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     const { searchParams } = new URL(req.url);
//     const daysParam = searchParams.get("days");
//     const raw = daysParam ? Number(daysParam) : NaN;
//     const days = Number.isFinite(raw) ? Math.max(1, Math.min(365, Math.floor(raw))) : 30;

//     const data = getAnalyticsData(days, userId);
//     return NextResponse.json(data);
//   } catch (err) {
//     console.error("[analytics] Error:", err);
//     return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
//   }
// }


import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsData } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const raw = Number(searchParams.get("days"));
    const days = Number.isFinite(raw)
      ? Math.max(1, Math.min(365, Math.floor(raw)))
      : 30;

    const data = getAnalyticsData(days, userId);

    return NextResponse.json(data);
  } catch (err) {
    console.error("========== ANALYTICS ERROR ==========");
    console.error(err);
    console.error("====================================");

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : "",
      },
      { status: 500 }
    );
  }
}