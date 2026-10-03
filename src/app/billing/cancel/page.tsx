// app/billing/cancel/page.tsx — reached when the user abandons / cancels
// the Razorpay Checkout modal (modal.ondismiss) OR arrives here via any
// future Razorpay hosted-checkout cancel URL. Pure static — nothing was
// charged, nothing to clean up.

import Link from "next/link";
import { XCircle, ArrowLeft, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Checkout cancelled · DM Shiyam",
  description: "Your checkout was cancelled. No charge was made.",
  robots: { index: false, follow: false },
};

// Next 16 made searchParams a Promise — destructuring it synchronously was
// silently returning the Promise's own `.plan` (undefined), so the Try-again
// link lost its plan slug. Caught by billing-and-legal.spec.ts.
export default async function BillingCancelPage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string }>;
}) {
  const resolved = (await searchParams) ?? {};
  const plan = (resolved.plan ?? "").trim();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800">
          <XCircle className="h-7 w-7 text-gray-500 dark:text-gray-400" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-white">
          Checkout cancelled
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          No charge was made. Your plan is unchanged. If something went
          wrong during payment (card declined, UPI timeout, etc.) try again
          — most issues resolve on a second attempt.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href={plan ? `/pricing?plan=${encodeURIComponent(plan)}` : "/pricing"}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ig-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-strong"
          >
            Try again <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
          Having trouble checking out?{" "}
          <a
            href="mailto:dmshiyamofficial@gmail.com"
            className="text-indigo-600 dark:text-indigo-400 underline"
          >
            Email support
          </a>{" "}
          and we&apos;ll walk you through it.
        </p>
      </div>
    </main>
  );
}
