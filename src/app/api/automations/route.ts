import { NextRequest, NextResponse } from "next/server";
import {
  getAllAutomations,
  getAutomation,
  createAutomation,
  updateAutomation,
  deleteAutomation,
} from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const automations = getAllAutomations({ userId });
    return NextResponse.json(automations);
  } catch (error) {
    console.error("Error fetching automations:", error);
    return NextResponse.json(
      { error: "Failed to fetch automations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    if (!body.name || !body.trigger_keywords || !body.dm_message) {
      return NextResponse.json(
        { error: "name, trigger_keywords, and dm_message are required" },
        { status: 400 }
      );
    }

    const automation = createAutomation({
      name: body.name,
      trigger_keywords: body.trigger_keywords,
      dm_message: body.dm_message,
      reply_comment: body.reply_comment,
      account_id: body.account_id,
      ai_enabled: body.ai_enabled,
      ai_system_prompt: body.ai_system_prompt,
      user_id: userId,
    });

    return NextResponse.json(automation, { status: 201 });
  } catch (error) {
    console.error("Error creating automation:", error);
    return NextResponse.json(
      { error: "Failed to create automation" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = getAutomation(body.id);
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const automation = updateAutomation(body.id, {
      name: body.name,
      trigger_keywords: body.trigger_keywords,
      dm_message: body.dm_message,
      reply_comment: body.reply_comment,
      is_active: body.is_active,
      account_id: body.account_id,
      ai_enabled: body.ai_enabled,
      ai_system_prompt: body.ai_system_prompt,
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(automation);
  } catch (error) {
    console.error("Error updating automation:", error);
    return NextResponse.json(
      { error: "Failed to update automation" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = getAutomation(id);
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    const deleted = deleteAutomation(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting automation:", error);
    return NextResponse.json(
      { error: "Failed to delete automation" },
      { status: 500 }
    );
  }
}
