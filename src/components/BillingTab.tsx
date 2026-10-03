"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CreditCard,
  Receipt,
  Crown,
  Clock,
  XCircle,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleX,
  Undo2,
} from "lucide-react";

// S5.8.5 — Dedicated billing dashboard tab. Pulls together everything a
// paying user wants when "what's going on with my subscription" is the
// question: current plan + status + next billing date, payment history
// from the webhook audit log, and the self-serve change/cancel actions.
//
// Non-paying users still get the tab (so they can see "No subscription
// yet" + an Upgrade CTA) — the dashboard header already pushes them to
// /pricing, but having it in the tab-strip means the experience is
// consistent whether they signed up today or three months ago.

type BillingStatus = {
  plan: string;
  subscription_status: string;
};

type HistoryEntry = {
  id: string;
  type: string;
  label: string;
  amount_paise: number | null;
  currency: "INR";
  status: "success" | "failed" | "refunded";
  payment_id: string | null;
  plan: string | null;
  received_at: string;
};

function formatInr(paise: number | null): string {
  if (paise == null) return "—";
  return (
    "₹" +
    (paise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  agency: "Agency",
};

export default function BillingTab() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        fetch("/api/billing/status").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/billing/history").then((r) => (r.ok ? r.json() : { events: [] })),
      ]);
      setStatus(s);
      setHistory(h?.events ?? []);
    } catch (err) {
      console.error("[billing] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCancel = useCallback(async () => {
    const ok = window.confirm(
      "Cancel your subscription?\n\nYou'll keep full access until the end of this billing cycle. You won't be charged again. You can resubscribe anytime."
    );
    if (!ok) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        if (res.status === 400 && /already/i.test(data.error ?? "")) {
          toast.info(data.error ?? "Already cancelled.");
          await refresh();
          return;
        }
        toast.error(data.error || "Failed to cancel subscription.");
        return;
      }
      toast.success(data.message || "Subscription cancelled.");
      await refresh();
    } catch (err) {
      console.error("[cancel] failed:", err);
      toast.error("Couldn't cancel right now. Please try again.");
    } finally {
      setCancelling(false);
    }
  }, [refresh]);

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-16 text-gray-400 shadow-soft dark:border-gray-800 dark:bg-gray-900">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading billing…
      </div>
    );
  }

  const plan = status?.plan ?? "free";
  const sub = status?.subscription_status ?? "none";
  const isFree = plan === "free";
  const isCancelled = sub === "cancelled";
  const isActive = sub === "active";

  return (
    <div className="space-y-6">
      {/* ────── Current plan card ────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-soft dark:border-gray-800 dark:bg-gray-900">
        {/* Gradient top strip ties the card into the site brand */}
        <div className="h-1 w-full bg-ig-gradient" aria-hidden />
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Current plan
              </span>
              {isCancelled && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
                  <Clock className="h-3 w-3" /> Cancels at period end
                </span>
              )}
              {!isCancelled && isActive && !isFree && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                {PLAN_LABELS[plan] ?? plan}
              </h2>
              {isFree && (
                <span className="text-sm text-gray-500">500 DMs/month, forever</span>
              )}
            </div>
            {isCancelled && (
              <p className="mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
                Your plan stays active until the end of your current billing
                cycle. After that your account automatically moves to Free —
                your data, automations, and connected accounts stay put.
              </p>
            )}
            {isFree && (
              <p className="mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
                You're on the free forever plan. Upgrade to unlock more DMs,
                AI Smart Replies, and multi-account support.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:min-w-[200px]">
            {isFree ? (
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ig-gradient bg-[length:200%_200%] px-5 py-2.5 text-sm font-semibold text-white shadow-strong transition-all hover:bg-[position:100%_0] hover:shadow-glow"
              >
                <Crown className="h-4 w-4" />
                See plans
              </Link>
            ) : (
              <>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-soft transition-all hover:border-gray-300 hover:shadow-medium dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  Change plan
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                {!isCancelled && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    {cancelling ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Cancelling…
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel plan
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ────── Payment history ────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-soft dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Payment history
            </h3>
          </div>
          <button
            onClick={refresh}
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {!history || history.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <CreditCard className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-700" />
            <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
              No payments yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Your subscription receipts and refund events will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {history.map((e) => (
              <HistoryRow key={e.id} entry={e} />
            ))}
          </ul>
        )}
      </div>

      {/* ────── Help footer ────── */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        <p>
          Need a GST invoice, a refund, or help with a failed payment? Email{" "}
          <a
            href="mailto:dmshiyamofficial@gmail.com"
            className="font-semibold text-gray-900 hover:underline dark:text-white"
          >
            dmshiyamofficial@gmail.com
          </a>{" "}
          — we reply within 24 hours.
        </p>
      </div>
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const iconMap: Record<HistoryEntry["type"] | string, React.ReactNode> = {
    subscription_activated: (
      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    ),
    payment_received: (
      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    ),
    payment_failed: (
      <div className="rounded-lg bg-red-50 p-2 text-red-600 dark:bg-red-950/40 dark:text-red-400">
        <CircleX className="h-4 w-4" />
      </div>
    ),
    refund_initiated: (
      <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
        <Undo2 className="h-4 w-4" />
      </div>
    ),
    subscription_cancelled: (
      <div className="rounded-lg bg-gray-100 p-2 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        <AlertTriangle className="h-4 w-4" />
      </div>
    ),
    subscription_ended: (
      <div className="rounded-lg bg-gray-100 p-2 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        <Clock className="h-4 w-4" />
      </div>
    ),
    other: (
      <div className="rounded-lg bg-gray-100 p-2 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        <Receipt className="h-4 w-4" />
      </div>
    ),
  };

  const amountDisplay =
    entry.amount_paise != null
      ? entry.type === "refund_initiated"
        ? `−${formatInr(entry.amount_paise)}`
        : formatInr(entry.amount_paise)
      : "—";
  const amountColor =
    entry.status === "failed"
      ? "text-red-600 dark:text-red-400"
      : entry.type === "refund_initiated"
        ? "text-amber-700 dark:text-amber-400"
        : "text-gray-900 dark:text-white";

  return (
    <li className="flex items-center gap-4 px-6 py-4">
      {iconMap[entry.type] ?? iconMap.other}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {entry.label}
          </span>
          {entry.plan && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              · {PLAN_LABELS[entry.plan] ?? entry.plan}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{formatDate(entry.received_at)}</span>
          {entry.payment_id && (
            <>
              <span>·</span>
              <span className="truncate font-mono">{entry.payment_id}</span>
            </>
          )}
        </div>
      </div>
      <div className={`shrink-0 text-sm font-semibold tabular-nums ${amountColor}`}>
        {amountDisplay}
      </div>
    </li>
  );
}
