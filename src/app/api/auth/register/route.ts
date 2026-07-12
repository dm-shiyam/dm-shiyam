import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    // Basic per-IP rate limit: 5 signups / 15 min
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const limited = rateLimit(`signup:${ip}`, 5, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body?.email || !body?.password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const email = String(body.email).trim().toLowerCase();
    const password = String(body.password);
    const name = body.name ? String(body.name).trim() : email.split("@")[0];

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Password policy: min 8 chars, letters + digits
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain letters and numbers" },
        { status: 400 }
      );
    }

    // Check duplicate
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const password_hash = await bcrypt.hash(password, 12);
    try {
      const user = await createUser({
        email,
        name,
        password_hash,
        provider: "credentials",
      });
      return NextResponse.json({
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (err: unknown) {
      // Postgres unique_violation — concurrent signup race
      const code = (err as { code?: string })?.code;
      if (code === "23505") {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 409 }
        );
      }
      console.error("[register] createUser failed:", err);
      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[register] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
