// components/PricingContent.tsx — Client Component with all pricing logic

"use client";

import Link from "next/link";
import Script from "next/script";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { trackEvent } from "@/lib/analytics";
import { PLANS } from "@/lib/plans";

// Razorpay Checkout Modal — loaded via <Script> below. The global is only
// present after the script tag has executed, hence the runtime check inside
// handleCheckout instead of a top-level import.
interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}
type RazorpayInstance = { open: () => void; on: (evt: string, cb: (e: unknown) => void) => void };
type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  handler: (response: RazorpayCheckoutResponse) => void;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
};
declare global {
  interface Window {
    Razorpay?: new (opts: RazorpayOptions) => RazorpayInstance;
  }
}

export default function PricingContent() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [checkoutLoading, setCheckoutLoading] = useState<null | string>(null);

  // Session context lets us:
  //   1. Show "Dashboard" / user email in the navbar instead of Login/Sign Up
  //      when the user is already authenticated (bug reported 2026-09-09).
  //   2. Mark the Free tier as "Current plan" when the user is on it.
  //   3. Route unauthenticated Subscribe clicks to /register?callbackUrl=/pricing
  //      so users don't lose their intent to buy.
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  const currentPlan =
    ((session?.user as Record<string, unknown> | undefined)?.plan as
      | string
      | undefined) ?? "free";

  const handleCheckout = async (plan: "pro" | "business") => {
    // Guard: user must be signed in — the checkout API requires a session
    // to attach the subscription to. If not, punt to /register carrying
    // the plan intent in the callback URL so they resume here after auth.
    if (!isAuthed) {
      window.location.href = `/register?callbackUrl=${encodeURIComponent(
        `/pricing?plan=${plan}`
      )}`;
      return;
    }
    // Guard: Razorpay Checkout script must be loaded first.
    if (typeof window === "undefined" || !window.Razorpay) {
      alert(
        "Payment library is still loading. Please wait a moment and try again."
      );
      return;
    }

    const amount = plan === "pro" ? 9900 : 99900; // paise; display copy only
    const planName = plan === "pro" ? "DM Shiyam Pro" : "DM Shiyam Business";

    // GA4 conversion — V13.4 subscription_started (checkout intent).
    // Fired at click time. The actual "paid" event is tracked server-side
    // via the Razorpay webhook (see `src/app/api/billing/webhook/route.ts`).
    trackEvent({
      name: "subscription_started",
      params: { plan, amount, currency: "INR" },
    });

    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, plan, planName }),
      });
      const data = await res.json();

      if (!data.subscription_id) {
        alert(data.error || "Failed to create subscription.");
        return;
      }

      // Open Razorpay Checkout Modal instead of navigating to the hosted
      // short_url — the hosted page is a "billing management" URL with no
      // way to redirect users back after payment (2026-09-09 fix).
      const rzp = new window.Razorpay({
        key: data.razorpay_key,
        subscription_id: data.subscription_id,
        name: "DM Shiyam",
        description: planName,
        theme: { color: "#6366f1" },
        handler: async (response) => {
          // Payment succeeded. Verify signature server-side, which also
          // upgrades the plan + writes razorpay_subscription_id.
          try {
            const verifyRes = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
                plan,
              }),
            });
            if (verifyRes.ok) {
              // Success — land on dashboard with a query param the client
              // can pick up to show a "Welcome to Pro" toast.
              window.location.href = "/dashboard?subscribed=" + plan;
            } else {
              const err = await verifyRes.json().catch(() => ({}));
              alert(
                "Payment received, but verification failed: " +
                  (err.error || "unknown") +
                  ". Please refresh — the Razorpay webhook will reconcile within a minute."
              );
            }
          } catch (err) {
            console.error("[checkout] verify failed:", err);
            alert(
              "Payment received. Refresh in a moment — the webhook will update your account."
            );
          }
        },
        modal: {
          ondismiss: () => {
            // User closed the modal before completing payment. No-op —
            // if they eventually pay, the webhook still fires.
            setCheckoutLoading(null);
          },
        },
      });
      rzp.open();
    } catch (err) {
      console.error("[checkout] create failed:", err);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      {/* Razorpay Checkout Modal (2026-09-09). Loaded via next/script with
          strategy="afterInteractive" so it's ready by the time a user can
          plausibly click Subscribe. Adds `window.Razorpay` constructor. */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />

      {/* Navbar (session-aware — 2026-09-09 fix). Was showing Login/Sign Up
          unconditionally even for logged-in users, making the pricing page
          look like the session had expired. */}
      <nav className="sticky top-0 z-40 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            DM Shiyam
          </Link>
          <div className="flex items-center gap-4">
            {isAuthed ? (
              <>
                <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                  {session?.user?.email}
                </span>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Choose the plan that fits your Instagram automation needs. Upgrade anytime.
          </p>
        </div>
      </section>

      {/* Pricing Cards Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Free Tier */}
          {/* Free Tier — data pulled from PLANS.free (single source of truth,
              2026-09-09 fix). Was hard-coded to "5 automations" but PLANS
              says 2; was "$0" (wrong currency). */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-8">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Free
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Perfect for getting started
              </p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                ₹0
              </span>
              <span className="text-gray-600 dark:text-gray-400 ml-2">
                forever
              </span>
            </div>

            {isAuthed && currentPlan === "free" ? (
              <button
                disabled
                className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg mb-8 cursor-not-allowed"
              >
                Current Plan
              </button>
            ) : (
              <Link
                href={isAuthed ? "/dashboard" : "/register"}
                className="block text-center w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg mb-8 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {isAuthed ? "Go to Dashboard" : "Sign up free"}
              </Link>
            )}

            <div className="space-y-4">
              <FeatureItem included>
                {PLANS.free.dm_limit.toLocaleString()} DMs/month
              </FeatureItem>
              <FeatureItem included>
                {PLANS.free.max_automations} automations
              </FeatureItem>
              <FeatureItem included>
                {PLANS.free.max_accounts} Instagram account
              </FeatureItem>
              <FeatureItem included>Community support</FeatureItem>
              <FeatureItem>Analytics dashboard</FeatureItem>
              <FeatureItem>AI Smart Replies</FeatureItem>
            </div>
          </div>

          {/* Pro Tier */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-indigo-600 p-8 relative shadow-lg">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                POPULAR
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Pro
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                For growing businesses
              </p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                {PLANS.pro.price_label}
              </span>
              <span className="text-gray-600 dark:text-gray-400 ml-2">
                /month
              </span>
            </div>

            <button
              onClick={() => handleCheckout("pro")}
              disabled={currentPlan === "pro"}
              className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors mb-8 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {currentPlan === "pro"
                ? "Current Plan"
                : isAuthed
                  ? "Upgrade to Pro"
                  : "Get Started with Pro"}
            </button>

            <div className="space-y-4">
              <FeatureItem included>
                {PLANS.pro.dm_limit.toLocaleString()} DMs/month
              </FeatureItem>
              <FeatureItem included>Unlimited automations</FeatureItem>
              <FeatureItem included>
                {PLANS.pro.max_accounts} Instagram accounts
              </FeatureItem>
              <FeatureItem included>AI Smart Replies</FeatureItem>
              <FeatureItem included>Full analytics</FeatureItem>
              <FeatureItem included>Priority support</FeatureItem>
            </div>
          </div>

          {/* Business Tier */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-8">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Business
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                For enterprises & agencies
              </p>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                {PLANS.business.price_label}
              </span>
              <span className="text-gray-600 dark:text-gray-400 ml-2">
                /month
              </span>
            </div>

            <button
              onClick={() => handleCheckout("business")}
              disabled={currentPlan === "business"}
              className="w-full py-3 px-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors mb-8 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {currentPlan === "business"
                ? "Current Plan"
                : isAuthed
                  ? "Upgrade to Business"
                  : "Get Started with Business"}
            </button>

            <div className="space-y-4">
              <FeatureItem included>
                {PLANS.business.dm_limit.toLocaleString()} DMs/month
              </FeatureItem>
              <FeatureItem included>Unlimited automations</FeatureItem>
              <FeatureItem included>
                {PLANS.business.max_accounts} Instagram accounts
              </FeatureItem>
              <FeatureItem included>AI Smart Replies</FeatureItem>
              <FeatureItem included>Full analytics + API access</FeatureItem>
              <FeatureItem included>Dedicated support</FeatureItem>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white text-center mb-4">
            Detailed Feature Comparison
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-2xl mx-auto">
            See exactly what's included in each plan
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300 dark:border-gray-700">
                <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">
                  Feature
                </th>
                <th className="text-center py-4 px-4 font-semibold text-gray-900 dark:text-white">
                  Free
                </th>
                <th className="text-center py-4 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                  Pro
                </th>
                <th className="text-center py-4 px-4 font-semibold text-gray-900 dark:text-white">
                  Business
                </th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow
                feature="Automations"
                free="5"
                pro="50"
                business="Unlimited"
              />
              <ComparisonRow
                feature="Instagram Accounts"
                free="1"
                pro="5"
                business="Unlimited"
              />
              <ComparisonRow
                feature="Analytics"
                free="Basic"
                pro="Advanced"
                business="Full + Reporting"
              />
              <ComparisonRow
                feature="DM Templates"
                free="Basic"
                pro="Custom"
                business="Custom + Library"
              />
              <ComparisonRow
                feature="API Access"
                free="❌"
                pro="❌"
                business="✅"
              />
              <ComparisonRow
                feature="Webhook Support"
                free="❌"
                pro="❌"
                business="✅"
              />
              <ComparisonRow
                feature="Support"
                free="Community"
                pro="Priority Email"
                business="Dedicated"
              />
              <ComparisonRow
                feature="Monthly Reports"
                free="❌"
                pro="❌"
                business="✅"
              />
              <ComparisonRow
                feature="Custom Integrations"
                free="❌"
                pro="❌"
                business="✅"
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 dark:bg-gray-900 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <FAQItem
              question="Can I upgrade or downgrade anytime?"
              answer="Yes. Upgrades take effect immediately and unlock the new tier's DM limit right away. Downgrades take effect at the end of your current billing cycle so you don't lose paid days."
            />
            <FAQItem
              question="How do I cancel my subscription?"
              answer="Cancel in one click from Dashboard → Settings → Subscription. You keep access until the end of the paid period; we don't pro-rate refunds for unused days, but there are also no cancellation fees or lock-ins."
            />
            <FAQItem
              question="Do you offer refunds?"
              answer="7-day money-back guarantee on your first paid month — email dmshiyamofficial@gmail.com within 7 days of the first charge and we'll refund it in full, no questions asked. After 7 days, refunds are handled case-by-case."
            />
            <FAQItem
              question="Is there a free trial?"
              answer="Yes — the Free plan gives you 500 DMs/month forever, no credit card. Use it to validate that DM Shiyam works for your niche before upgrading. Most creators only need to upgrade once they hit the 500 DM cap."
            />
            <FAQItem
              question="What happens if I exceed my plan limits?"
              answer="You'll get an email + in-app alert at 80% of your monthly cap. If you exhaust it, new triggers pause until the 1st of the next month (or you can upgrade anytime for an instant limit bump). We never send DMs and charge you for overages — hard cap by design."
            />
            <FAQItem
              question="Is this Instagram-safe? Will my account get banned?"
              answer="Yes — DM Shiyam uses Meta's official Instagram Graph API (not scraping / not automation via mobile app), and we're a Meta-reviewed app with instagram_manage_messages and instagram_business_manage_messages Advanced Access. We respect Instagram's messaging window (24 hours) and rate limits. Zero accounts banned to date across our user base."
            />
            <FAQItem
              question="Do I need an Instagram Business or Creator account?"
              answer="Yes — Instagram's API only allows DMs from Business or Creator accounts (not personal). Switching is free and takes 30 seconds in the Instagram app: Settings → Account → Switch to Professional Account. You'll also need to link it to a Facebook Page."
            />
            <FAQItem
              question="Do prices include GST?"
              answer="Prices shown are exclusive of GST. Indian customers are charged 18% GST on top, which appears on your invoice. International customers pay in INR without GST."
            />
            <FAQItem
              question="Can I pay via UPI / net banking / international card?"
              answer="Yes — all major Indian payment methods work: UPI (GPay/PhonePe/Paytm), all Indian debit + credit cards, net banking, and Razorpay-supported wallets. International Visa/Mastercard/Amex cards also work."
            />
            <FAQItem
              question="Can I connect multiple Instagram accounts?"
              answer="Starter supports 1 account. Pro supports 3. Business supports 10. Agency is unlimited. Each account has its own DM quota and automations, and you can manage all of them from a single dashboard."
            />
            <FAQItem
              question="Can I use AI-generated replies?"
              answer="Pro / Business / Agency plans include AI Smart Replies powered by GPT-4o-mini — writes personalized DMs based on each comment's context, in your brand voice. Starter and Free use static templates only."
            />
            <FAQItem
              question="What if my Instagram token expires?"
              answer="We automatically refresh Instagram long-lived tokens 7 days before expiry — no action needed. If a refresh ever fails (e.g., you revoked our app permissions), you'll get an email alert with a one-click reconnect link."
            />
            <FAQItem
              question="Do you offer discounts for annual billing?"
              answer="Annual billing launches in Q4 2026 with a 20% discount (2.4 months free). Existing monthly subscribers get first access — subscribe now to lock in the beta discount."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800 rounded-2xl p-12 sm:p-16 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to automate your DMs?
          </h2>
          <p className="text-lg text-indigo-100 mb-8 max-w-2xl mx-auto">
            Start free with 500 DMs/month — no credit card, no time limit. Upgrade only when you outgrow it.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-white text-indigo-600 font-bold rounded-lg hover:bg-gray-100 transition-colors text-lg"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-white py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold mb-4">DM Shiyam</h3>
              <p className="text-gray-400 text-sm">
                Automate your Instagram DMs and grow faster.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <Link href="/" className="hover:text-white">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <Link href="/privacy" className="hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <p className="text-gray-400 text-sm">
                <a
                  href="mailto:dmshiyamofficial@gmail.com"
                  className="hover:text-white"
                >
                  dmshiyamofficial@gmail.com
                </a>
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
            <p>
              &copy; {new Date().getFullYear()} DM Shiyam. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureItem({
  children,
  included = false,
}: {
  children: React.ReactNode;
  included?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={included ? "text-green-500 text-lg" : "text-gray-300 text-lg"}>
        {included ? "✓" : "✗"}
      </span>
      <span
        className={
          included
            ? "text-gray-700 dark:text-gray-300"
            : "text-gray-500 dark:text-gray-500"
        }
      >
        {children}
      </span>
    </div>
  );
}

function ComparisonRow({
  feature,
  free,
  pro,
  business,
}: {
  feature: string;
  free: string;
  pro: string;
  business: string;
}) {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      <td className="py-4 px-4 font-medium text-gray-900 dark:text-white">
        {feature}
      </td>
      <td className="py-4 px-4 text-center text-gray-700 dark:text-gray-300">
        {free}
      </td>
      <td className="py-4 px-4 text-center text-gray-700 dark:text-gray-300 bg-indigo-50 dark:bg-indigo-900/20">
        {pro}
      </td>
      <td className="py-4 px-4 text-center text-gray-700 dark:text-gray-300">
        {business}
      </td>
    </tr>
  );
}

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left font-semibold text-gray-900 dark:text-white flex items-center justify-between hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        {question}
        <span className="text-2xl">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <p className="mt-4 text-gray-700 dark:text-gray-400 leading-relaxed">
          {answer}
        </p>
      )}
    </div>
  );
}