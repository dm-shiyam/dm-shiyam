import { NextRequest, NextResponse } from "next/server";
import { getAllAccounts, getAccount, createAccount, updateAccount, deleteAccount } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accounts = getAllAccounts(userId);
    // Strip access tokens from response for security, add token status
    const safe = accounts.map((a) => {
      let token_status: "valid" | "expiring_soon" | "expired" | "never_expires" | "unknown" = "unknown";
      if (!a.token_expires_at) {
        token_status = "never_expires";
      } else {
        const expiryTime = new Date(a.token_expires_at).getTime();
        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (expiryTime < now) token_status = "expired";
        else if (expiryTime - now < sevenDays) token_status = "expiring_soon";
        else token_status = "valid";
      }
      return {
        ...a,
        access_token: a.access_token ? "••••" + a.access_token.slice(-8) : "",
        token_status,
      };
    });
    return NextResponse.json(safe);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.instagram_account_id || !body.instagram_username || !body.access_token) {
      return NextResponse.json(
        { error: "instagram_account_id, instagram_username, and access_token are required" },
        { status: 400 }
      );
    }

    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const account = createAccount({
      instagram_account_id: body.instagram_account_id,
      instagram_username: body.instagram_username,
      access_token: body.access_token,
      page_id: body.page_id,
      user_id: userId,
    });

    return NextResponse.json(
      { ...account, access_token: "••••" + account.access_token.slice(-8) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating account:", error);
    const msg = error instanceof Error && error.message.includes("UNIQUE")
      ? "This Instagram account is already connected"
      : "Failed to create account";
    return NextResponse.json({ error: msg }, { status: 500 });
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

    const existing = getAccount(body.id);
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const account = updateAccount(body.id, {
      instagram_username: body.instagram_username,
      access_token: body.access_token,
      page_id: body.page_id,
      is_active: body.is_active,
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...account,
      access_token: "••••" + account.access_token.slice(-8),
    });
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
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

    const existing = getAccount(id);
    if (!existing || existing.user_id !== userId) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const deleted = deleteAccount(id);
    if (!deleted) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
