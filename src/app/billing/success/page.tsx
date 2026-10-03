// app/billing/success/page.tsx — post-checkout confirmation landing
//
// Entered after the Razorpay Checkout modal's `handler` callback resolves
// (see PricingContent.handleCheckout). Query params:
//   subscription — razorpay_subscription_id (sub_XXXXXXXXXXXX)
//   plan         — "starter" | "pro" | "business" | "agency"
//   cycle        — "monthly" | "yearly"
//
// Behaviour
// ─────────
// • Polls GET /api/billing/status until `subscription_status === "active"`
//   or ~15 s has elapsed — the real plan flip happens from the Razorpay
//   webhook, which can race with the client landing here.
// • Shows a receipt card: plan name, amount, cycle, subscription_id and a
//   "Go to dashboard" CTA.
// • Does NOT fire GA4 `subscription_started` — that's authoritative on the
//   server (src/app/api/billing/webhook/route.ts fires it exactly once, on
//   first activation only, with the real amount and cycle in `notes`).

import { Suspense } from "react";
import BillingSuccessClient from "./BillingSuccessClient";

export const metadata = {
  title: "Subscription activated · DM Shiyam",
  description: "Your DM Shiyam subscription is confirmed.",
  robots: { index: false, follow: false },
};

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<SuccessSkeleton />}>
      <BillingSuccessClient />
    </Suspense>
  );
}

function SuccessSkeleton() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <div className="h-6 w-40 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="mt-4 h-4 w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="mt-2 h-4 w-5/6 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    </main>
  );
}
