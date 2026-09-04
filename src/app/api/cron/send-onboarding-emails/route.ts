// src/app/api/cron/send-onboarding-emails/route.ts
// A13: Daily drip cron. Fires the onboarding sequence based on user signup age.
// Idempotency guaranteed by claimOnboardingEmail() — safe to retry.

import { NextRequest, NextResponse } from "next/server";
import {
  claimOnboardingEmail,
  getOnboardingCandidates,
  type OnboardingEmailType,
} from "@/lib/db";
import {
  sendConnectIgNudge,
  sendFirstAutomationNudge,
  sendCaseStudyEmail,
  sendUpgradeNudge,
} from "@/lib/email";

const CRON_SECRET = process.env.CRON_SECRET || "";

type StepResult = {
  step: OnboardingEmailType;
  candidates: number;
  sent: number;
  skipped: number;
  errors: number;
};

async function handler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "") || "";
  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: StepResult[] = [];

  // ── 13.2 Day 1 — connect IG nudge (only if user hasn't connected) ──
  results.push(await runStep("connect_ig_day1", 1, 2, async (user) => {
    if (user.has_account) return "skipped";
    await sendConnectIgNudge({ to: user.email, name: user.name });
    return "sent";
  }));

  // ── 13.3 Day 3 — first automation nudge (only if none created yet) ──
  results.push(await runStep("first_automation_day3", 3, 4, async (user) => {
    if (user.automation_count > 0) return "skipped";
    await sendFirstAutomationNudge({
      to: user.email,
      name: user.name,
      hasAccount: user.has_account,
    });
    return "sent";
  }));

  // ── 13.4 Day 7 — case study (send to everyone still in trial) ──
  results.push(await runStep("case_study_day7", 7, 8, async (user) => {
    await sendCaseStudyEmail({ to: user.email, name: user.name });
    return "sent";
  }));

  // ── 13.5 Day 12 — upgrade nudge (skip if already paying) ──
  results.push(await runStep("upgrade_day12", 12, 13, async (user) => {
    if (user.plan !== "free" || user.subscription_status === "active") {
      return "skipped";
    }
    await sendUpgradeNudge({ to: user.email, name: user.name });
    return "sent";
  }));

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    results,
  });
}

async function runStep(
  step: OnboardingEmailType,
  minDays: number,
  maxDays: number,
  sender: (
    user: Awaited<ReturnType<typeof getOnboardingCandidates>>[number]
  ) => Promise<"sent" | "skipped">
): Promise<StepResult> {
  const result: StepResult = {
    step,
    candidates: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const candidates = await getOnboardingCandidates(step, minDays, maxDays);
    result.candidates = candidates.length;

    for (const user of candidates) {
      try {
        // Atomically claim before sending so parallel invocations can't double-send.
        const claimed = await claimOnboardingEmail(user.id, step);
        if (!claimed) {
          result.skipped++;
          continue;
        }
        const outcome = await sender(user);
        if (outcome === "sent") result.sent++;
        else result.skipped++;
      } catch (err) {
        result.errors++;
        console.error(
          `[cron:onboarding-emails] ${step} failed for user ${user.id}:`,
          err
        );
      }
    }
  } catch (err) {
    result.errors++;
    console.error(`[cron:onboarding-emails] ${step} step failed:`, err);
  }

  return result;
}

export async function GET(req: NextRequest) {
  return handler(req);
}
export async function POST(req: NextRequest) {
  return handler(req);
}
