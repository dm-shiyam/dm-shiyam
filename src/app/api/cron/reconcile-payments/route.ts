// src/app/api/cron/reconcile-payments/route.ts
// V11 — Nightly Razorpay ↔ Postgres reconciliation.
//
// Purpose:
//   Detect drift between what Razorpay says happened (payments captured in
//   the last 24h) and what our subscriptions table records. Any mismatch
//   here means a webhook was missed or an operator manually flipped a row.
//
// Runs on Vercel cron (see `vercel.json`) once a day. Auth via `CRON_SECRET`.
//
// Reconciliation is read-only. We *never* auto-repair the DB — a mismatch
// fires a Sentry alert so a human can decide what actually happened.

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Razorpay pagination can take a few seconds

import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import {
  getActiveSubscribers,
  getUserByRazorpaySubscriptionId,
} from "@/lib/db";
import { captureAlert, captureError } from "@/lib/monitoring";

const CRON_SECRET = process.env.CRON_SECRET || "";

// Same "look-back" window that the cron cadence covers, plus a small buffer
// so a payment that arrived 23h59m ago is definitely caught by tomorrow's run.
const WINDOW_HOURS = 25;

// Razorpay caps `payments.all()` at 100 per page. Paginate up to this many
// pages to bound worst-case runtime.
const MAX_PAGES = 20;

// A local subscription is considered "stale" if its `updated_at` predates
// this window and we haven't seen a payment for it. Older than that + no
// payment likely means their sub silently expired (missed webhook).
const STALE_SUB_DAYS = 40; // > monthly billing cycle + grace

interface RazorpayPayment {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: string; // "captured" | "failed" | "authorized" | "refunded"
  order_id: string | null;
  invoice_id: string | null;
  method: string;
  created_at: number; // unix seconds
  captured: boolean;
  notes: Record<string, string> | null;
  // Only present on subscription payments
  subscription_id?: string;
}

interface RazorpayPaymentsResponse {
  entity: "collection";
  count: number;
  items: RazorpayPayment[];
}

interface Mismatch {
  type:
    | "orphan_payment" // Razorpay charged but no user row
    | "inactive_user_charged" // charged but DB says inactive
    | "active_no_recent_payment"; // DB says active but no recent charge
  razorpay_payment_id?: string;
  subscription_id?: string;
  user_id?: string;
  user_email?: string;
  amount?: number;
  detail: string;
}

function getRazorpay(): Razorpay | null {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
}

async function fetchLast24hPayments(
  razorpay: Razorpay
): Promise<RazorpayPayment[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - WINDOW_HOURS * 60 * 60;

  const all: RazorpayPayment[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = (await razorpay.payments.all({
      from,
      to: now,
      count: 100,
      skip: page * 100,
    })) as unknown as RazorpayPaymentsResponse;

    const items = res?.items ?? [];
    all.push(...items);
    if (items.length < 100) break; // last page
  }
  return all;
}

async function handler(req: NextRequest) {
  // ---------------------------------------------------------------------
  // 1) Auth — matches the pattern used by other cron endpoints
  // ---------------------------------------------------------------------
  const authHeader = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);
  const providedSecret =
    authHeader?.replace("Bearer ", "") || searchParams.get("secret") || "";

  if (!CRON_SECRET) {
    console.error("[cron:reconcile] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 401 }
    );
  }
  if (providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---------------------------------------------------------------------
  // 2) Razorpay must be configured
  // ---------------------------------------------------------------------
  const razorpay = getRazorpay();
  if (!razorpay) {
    captureAlert(
      "Reconciliation cron ran without Razorpay keys configured",
      { route: "cron/reconcile-payments" },
      "warning"
    );
    return NextResponse.json(
      { error: "Razorpay keys not configured" },
      { status: 503 }
    );
  }

  const mismatches: Mismatch[] = [];
  const startedAt = new Date().toISOString();

  try {
    // -------------------------------------------------------------------
    // 3) Pull last 24h payments from Razorpay
    // -------------------------------------------------------------------
    const payments = await fetchLast24hPayments(razorpay);
    const captured = payments.filter((p) => p.status === "captured");

    // Track which of our subscription ids we've already validated so we can
    // detect "active users with no recent payment" in step 4.
    const seenSubscriptionIds = new Set<string>();

    // -------------------------------------------------------------------
    // 3a) Forward pass: for each captured Razorpay payment, verify our
    //     user row exists and is marked active.
    // -------------------------------------------------------------------
    for (const p of captured) {
      const subId = p.subscription_id ?? p.notes?.subscription_id ?? null;

      if (!subId) {
        // One-off order payment (not tied to a subscription). Nothing to
        // reconcile here — we only track recurring subscriptions.
        continue;
      }

      seenSubscriptionIds.add(subId);

      const user = await getUserByRazorpaySubscriptionId(subId);
      if (!user) {
        mismatches.push({
          type: "orphan_payment",
          razorpay_payment_id: p.id,
          subscription_id: subId,
          amount: p.amount,
          detail: `Razorpay captured ₹${(p.amount / 100).toFixed(
            2
          )} for subscription ${subId} but no local user is linked to it.`,
        });
        continue;
      }

      if (user.subscription_status !== "active") {
        mismatches.push({
          type: "inactive_user_charged",
          razorpay_payment_id: p.id,
          subscription_id: subId,
          user_id: user.id,
          user_email: user.email,
          amount: p.amount,
          detail: `User ${user.email} was charged but local subscription_status is '${user.subscription_status}'. A webhook may have been missed.`,
        });
      }
    }

    // -------------------------------------------------------------------
    // 3b) Reverse pass: users we consider active but who have no recent
    //     captured payment.
    //
    //     Only flag if the subscription is older than STALE_SUB_DAYS —
    //     brand-new subscriptions inside the current billing cycle
    //     legitimately have no fresh charge.
    // -------------------------------------------------------------------
    const activeSubs = await getActiveSubscribers();
    const staleCutoff = Date.now() - STALE_SUB_DAYS * 24 * 60 * 60 * 1000;

    for (const sub of activeSubs) {
      if (!sub.razorpay_subscription_id) continue;
      if (seenSubscriptionIds.has(sub.razorpay_subscription_id)) continue;

      const updatedAtMs = new Date(sub.updated_at).getTime();
      if (updatedAtMs > staleCutoff) continue; // still within grace window

      mismatches.push({
        type: "active_no_recent_payment",
        subscription_id: sub.razorpay_subscription_id,
        user_id: sub.id,
        user_email: sub.email,
        detail: `Subscription ${sub.razorpay_subscription_id} is marked active locally but has had no Razorpay charge in the last ${STALE_SUB_DAYS} days.`,
      });
    }

    // -------------------------------------------------------------------
    // 4) Alerting
    // -------------------------------------------------------------------
    if (mismatches.length > 0) {
      // `captureAlert` context only accepts scalar values, so we JSON-encode
      // the sample and clip the length so a huge mismatch list can't blow
      // through Sentry's tag/context size limits.
      const sample = JSON.stringify(mismatches.slice(0, 10)).slice(0, 4000);
      captureAlert(
        `Payment reconciliation: ${mismatches.length} mismatch(es)`,
        {
          route: "cron/reconcile-payments",
          startedAt,
          totalCapturedPayments: captured.length,
          totalActiveSubs: activeSubs.length,
          mismatchSample: sample,
        },
        "warning"
      );
    }

    return NextResponse.json({
      success: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      window_hours: WINDOW_HOURS,
      totals: {
        razorpay_payments_scanned: payments.length,
        razorpay_payments_captured: captured.length,
        active_local_subscriptions: activeSubs.length,
        mismatches: mismatches.length,
      },
      mismatches,
    });
  } catch (err) {
    captureError(err, { route: "cron/reconcile-payments" });
    return NextResponse.json(
      { error: "Reconciliation failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handler(req);
}
export async function GET(req: NextRequest) {
  return handler(req);
}
