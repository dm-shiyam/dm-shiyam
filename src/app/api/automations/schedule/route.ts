import { NextRequest, NextResponse } from "next/server";
import { getAutomation, updateAutomationSchedule } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function PUT(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, schedule_enabled, schedule_start_hour, schedule_end_hour, schedule_days } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const automation = getAutomation(id);
    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    if (automation.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const startHour = schedule_start_hour ?? 0;
    const endHour = schedule_end_hour ?? 23;
    if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
      return NextResponse.json({ error: "Hours must be 0–23" }, { status: 400 });
    }

    const validDays = /^[0-6](,[0-6])*$/;
    if (schedule_days && !validDays.test(schedule_days)) {
      return NextResponse.json({ error: "schedule_days must be comma-separated 0–6 (0=Sun)" }, { status: 400 });
    }

    const updated = updateAutomationSchedule(id, {
      schedule_enabled: !!schedule_enabled,
      schedule_start_hour: startHour,
      schedule_end_hour: endHour,
      schedule_days: schedule_days ?? "0,1,2,3,4,5,6",
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Schedule update error:", error);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}
