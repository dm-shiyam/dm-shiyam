// GET /api/health — public unauth'd health check for uptime monitoring
//
// Returns 200 when all critical dependencies are reachable; 503 otherwise.
// Designed for:
//   • Uptime monitoring (UptimeRobot / Better Stack / Pingdom)
//   • Load balancer readiness probes
//   • Post-deploy smoke tests (V9 domain cutover verification)
//   • On-call incident triage — quickly narrows down which dep is down
//
// Response shape:
// {
//   "status": "ok" | "degraded" | "down",
//   "uptime_seconds": 12345,
//   "timestamp": "2026-09-05T07:30:00.000Z",
//   "checks": {
//     "database":  { "status": "ok", "latency_ms": 12 },
//     "meta_api":  { "status": "ok", "latency_ms": 145 },
//     "razorpay":  { "status": "ok", "latency_ms": 220 },
//     "env":       { "status": "ok", "missing": [] }
//   }
// }

import { NextResponse } from "next/server";
import { pool } from "@/lib/db-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // pg driver requires Node runtime

// Track process start so we can report uptime — module-level, evaluated once per instance
const PROCESS_STARTED_AT = Date.now();

// Critical env vars — missing any of these means the app can't function
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "INSTAGRAM_APP_ID",
  "INSTAGRAM_APP_SECRET",
  "WEBHOOK_VERIFY_TOKEN",
] as const;

type CheckStatus = "ok" | "degraded" | "down" | "skipped";

interface DependencyCheck {
  status: CheckStatus;
  latency_ms?: number;
  error?: string;
  detail?: Record<string, unknown>;
}

/** Race a promise against a timeout — returns "down" if it takes too long. */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkDatabase(): Promise<DependencyCheck> {
  const start = Date.now();
  try {
    await withTimeout(pool.query("SELECT 1 AS ok"), 3000, "database");
    return { status: "ok", latency_ms: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkMetaApi(): Promise<DependencyCheck> {
  const start = Date.now();
  try {
    // Unauth'd GET to graph.instagram.com root returns a small JSON error.
    // We only care that the endpoint is reachable, not that the call succeeds.
    // 400 with a well-formed error body = Meta is up.
    const res = await withTimeout(
      fetch("https://graph.instagram.com/v21.0/", { method: "GET" }),
      5000,
      "meta_api"
    );
    const latency = Date.now() - start;
    // Meta returns 400 for unauth'd requests — that's a reachable API
    if (res.status >= 500) {
      return {
        status: "degraded",
        latency_ms: latency,
        error: `Meta API returned ${res.status}`,
      };
    }
    return { status: "ok", latency_ms: latency };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkRazorpay(): Promise<DependencyCheck> {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return {
      status: "skipped",
      detail: { reason: "RAZORPAY_KEY_ID/SECRET not configured" },
    };
  }

  const start = Date.now();
  try {
    // Lightweight authenticated ping — list 1 payment. Confirms:
    //   1. Razorpay API is reachable
    //   2. Our credentials are valid (not expired/revoked)
    // Uses Basic auth per Razorpay docs.
    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString("base64");

    const res = await withTimeout(
      fetch("https://api.razorpay.com/v1/payments?count=1", {
        headers: { Authorization: `Basic ${auth}` },
      }),
      5000,
      "razorpay"
    );
    const latency = Date.now() - start;

    if (res.status === 401) {
      return {
        status: "down",
        latency_ms: latency,
        error: "Razorpay credentials rejected (401) — key rotated or invalid",
      };
    }
    if (res.status >= 500) {
      return {
        status: "degraded",
        latency_ms: latency,
        error: `Razorpay API returned ${res.status}`,
      };
    }
    return { status: "ok", latency_ms: latency };
  } catch (err) {
    return {
      status: "down",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function checkEnv(): DependencyCheck {
  const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return {
      status: "down",
      error: `Missing required env vars: ${missing.join(", ")}`,
      detail: { missing },
    };
  }
  return { status: "ok" };
}

export async function GET() {
  // Run all checks in parallel — they're independent
  const [database, meta_api, razorpay] = await Promise.all([
    checkDatabase(),
    checkMetaApi(),
    checkRazorpay(),
  ]);
  const env = checkEnv();

  const checks = { database, meta_api, razorpay, env };

  // Overall status = worst of all check statuses (ignoring "skipped")
  const statuses = Object.values(checks)
    .map((c) => c.status)
    .filter((s): s is Exclude<CheckStatus, "skipped"> => s !== "skipped");

  let overall: "ok" | "degraded" | "down";
  if (statuses.includes("down")) {
    overall = "down";
  } else if (statuses.includes("degraded")) {
    overall = "degraded";
  } else {
    overall = "ok";
  }

  const body = {
    status: overall,
    uptime_seconds: Math.floor((Date.now() - PROCESS_STARTED_AT) / 1000),
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    checks,
  };

  // Return 200 for ok/degraded (still serving traffic), 503 for down
  const httpStatus = overall === "down" ? 503 : 200;

  // No-cache: uptime monitors must always see fresh data
  return NextResponse.json(body, {
    status: httpStatus,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
