import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { isAdmin, getAllUsers, updateUserAdmin, deleteUser } from "@/lib/db";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const users = await getAllUsers();
    return NextResponse.json(users);
  } catch (err) {
    console.error("[admin/users] Error:", err);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const {
      targetUserId,
      plan,
      dm_limit,
      dms_used_this_month,
      role,
      subscription_status,
      razorpay_subscription_id,
      razorpay_customer_id,
    } = await req.json();
    if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 });

    // Matches the schema.sql CHECK constraint on users.subscription_status.
    const VALID_SUBSCRIPTION_STATUSES = ["none", "active", "past_due", "cancelled", "expired"];
    if (subscription_status !== undefined && !VALID_SUBSCRIPTION_STATUSES.includes(subscription_status)) {
      return NextResponse.json({ error: "Invalid subscription_status" }, { status: 400 });
    }

    const updated = await updateUserAdmin(targetUserId, {
      plan,
      dm_limit,
      dms_used_this_month,
      role,
      subscription_status,
      razorpay_subscription_id,
      razorpay_customer_id,
    });
    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[admin/users] PATCH Error:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { targetUserId } = await req.json();
    if (!targetUserId) return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
    if (targetUserId === userId) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });

    const deleted = await deleteUser(targetUserId);
    if (!deleted) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/users] DELETE Error:", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}