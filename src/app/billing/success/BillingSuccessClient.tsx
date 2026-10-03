"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import { PLANS, type PlanType } from "@/lib/plans";

type BillingStatus = {
  plan: string;
  subscription_status: string;
};

type PollState =
  | { phase: "polling"; attempt: number }
  | { phase: "active"; status: BillingStatus }
  | { phase: "pending"; status: BillingStatus | null }
  | { phase: "error"; message: string };

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 10; // 10 × 1.5 s ≈ 15 s

function isPlan(x: string): x is PlanType {
  return x === "starter" || x === "pro" || x === "business" || x === "agency" || x === "free";
}

function formatInr(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  })}`;
}

export default function BillingSuccessClient() {
  const params = useSearchParams();
  const subscriptionId = params.get("subscription") ?? "";
  const planParam = (params.get("plan") ?? "").toLowerCase();
  const cycleParam = (params.get("cycle") ?? "monthly").toLowerCase();

  const plan: PlanType | null = isPlan(planParam) ? planParam : null;
  const cycle: "monthly" | "yearly" =
    cycleParam === "yearly" ? "yearly" : "monthly";

  const [state, setState] = useState<PollState>({
    phase: "polling",
    attempt: 0,
  });

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    const tick = async () => {
      if (cancelled) return;
      attempt += 1;
      try {
        const res = await fetch("/api/billing/status", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as BillingStatus;
        if (cancelled) return;

        if (data.subscription_status === "active") {
          setState({ phase: "active", status: data });
          return; // stop polling
        }
        if (attempt >= POLL_MAX_ATTEMPTS) {
          setState({ phase: "pending", status: data });
          return;
        }
        setState({ phase: "polling", attempt });
        setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        if (attempt >= POLL_MAX_ATTEMPTS) {
          setState({
            phase: "error",
            message: err instanceof Error ? err.message : String(err),
          });
          return;
        }
        setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  const planConfig = plan ? PLANS[plan] : null;
  const amountPaise =
    planConfig && cycle === "yearly" && planConfig.price_yearly
      ? planConfig.price_yearly
      : planConfig?.price_monthly ?? 0;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <Header state={state} />

        {planConfig && (
          <dl className="mt-6 divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden text-sm">
            <Row label="Plan" value={`${planConfig.name} (${cycle === "yearly" ? "Yearly" : "Monthly"})`} />
            <Row label="Amount" value={formatInr(amountPaise)} />
            {subscriptionId && (
              <Row
                label="Subscription ID"
                value={<code className="text-xs">{subscriptionId}</code>}
              />
            )}
            <Row
              label="Status"
              value={
                state.phase === "active" ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Active
                  </span>
                ) : state.phase === "pending" ? (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    Confirming…
                  </span>
                ) : state.phase === "error" ? (
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    Couldn&apos;t confirm
                  </span>
                ) : (
                  <span className="text-gray-500">Checking…</span>
                )
              }
            />
          </dl>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ig-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-strong"
          >
            Open dashboard <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            View all plans
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
          A tax invoice from Razorpay will be emailed to the address on your
          account. Need help?{" "}
          <a
            href="mailto:dmshiyamofficial@gmail.com"
            className="text-indigo-600 dark:text-indigo-400 underline"
          >
            Email support
          </a>
          .
        </p>
      </div>
    </main>
  );
}

function Header({ state }: { state: PollState }) {
  if (state.phase === "active") {
    return (
      <div>
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">
          You&apos;re all set
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Payment confirmed. Your plan is active and your new DM limits are
          already live.
        </p>
      </div>
    );
  }
  if (state.phase === "pending") {
    return (
      <div>
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/40">
          <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">
          Payment received — confirming
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Razorpay has your payment. We&apos;re waiting on their confirmation
          webhook (usually seconds, occasionally a minute). Refresh this page
          if your plan isn&apos;t active yet — it will activate
          automatically.
        </p>
      </div>
    );
  }
  if (state.phase === "error") {
    return (
      <div>
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-900/40">
          <AlertTriangle className="h-7 w-7 text-rose-600 dark:text-rose-400" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">
          Payment received — couldn&apos;t confirm status
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Your charge went through. We just couldn&apos;t reach our server to
          confirm the activation ({state.message}). Open the dashboard — if
          the new plan isn&apos;t visible in a minute, email support and
          we&apos;ll sort it out instantly.
        </p>
      </div>
    );
  }
  // polling
  return (
    <div>
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40">
        <Loader2 className="h-7 w-7 text-indigo-600 dark:text-indigo-400 animate-spin" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">
        Confirming your subscription…
      </h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        Payment received. Waiting on Razorpay&apos;s activation webhook — this
        usually takes a couple of seconds.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-white text-right">
        {value}
      </dd>
    </div>
  );
}
