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

  const handleCheckout = async (
    plan: "starter" | "pro" | "business" | "agency"
  ) => {
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

    // V-fix — was hardcoded to ₹99/₹999 (paise) while PLANS.pro=₹799 and
    // PLANS.business=₹2,499. Razorpay charges the correct amount server-side
    // from plan_id, but the Checkout MODAL displayed ₹99 / ₹999 to the user,
    // and the GA4 subscription_started event reported fake revenue 10x low.
    // Pull from PLANS so the modal price, GA event, and actual charge agree.
    const amount = PLANS[plan].price_monthly;
    const planName = `DM Shiyam ${PLANS[plan].name}`;

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

      {/* Pricing Cards Section — 4 self-serve tiers in a responsive grid.
          Agency (unlimited) lives in its own band below because it's usually
          a conversation (custom seat counts, white-label branding) rather
          than a Razorpay click. */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Free Tier */}
          <PricingCard
            plan="free"
            tagline="Perfect for getting started"
            priceSuffix="forever"
            isAuthed={isAuthed}
            currentPlan={currentPlan}
            checkoutLoading={checkoutLoading}
            onCheckout={handleCheckout}
            features={[
              `${PLANS.free.dm_limit.toLocaleString()} DMs/month`,
              `${PLANS.free.max_automations} automations`,
              `${PLANS.free.max_accounts} Instagram account`,
              "Community support",
            ]}
            excludedFeatures={["Analytics dashboard", "AI Smart Replies"]}
          />

          {/* Starter Tier — new (2026-09-11). The bridge between free and pro
              for solo creators who've validated the free tier and need more
              DMs but don't yet need AI or multi-account. */}
          <PricingCard
            plan="starter"
            tagline="For solo creators"
            priceSuffix="/month"
            isAuthed={isAuthed}
            currentPlan={currentPlan}
            checkoutLoading={checkoutLoading}
            onCheckout={handleCheckout}
            features={[
              `${PLANS.starter.dm_limit.toLocaleString()} DMs/month`,
              `${PLANS.starter.max_automations} automations`,
              `${PLANS.starter.max_accounts} Instagram account`,
              "Analytics dashboard",
              "Email support",
            ]}
            excludedFeatures={["AI Smart Replies", "Multi-account"]}
          />

          {/* Pro Tier — POPULAR (default recommendation) */}
          <PricingCard
            plan="pro"
            tagline="For growing businesses"
            priceSuffix="/month"
            isAuthed={isAuthed}
            currentPlan={currentPlan}
            checkoutLoading={checkoutLoading}
            onCheckout={handleCheckout}
            popular
            features={[
              `${PLANS.pro.dm_limit.toLocaleString()} DMs/month`,
              "Unlimited automations",
              `${PLANS.pro.max_accounts} Instagram accounts`,
              "AI Smart Replies",
              "Full analytics",
              "Priority support",
            ]}
          />

          {/* Business Tier */}
          <PricingCard
            plan="business"
            tagline="For teams & bigger brands"
            priceSuffix="/month"
            isAuthed={isAuthed}
            currentPlan={currentPlan}
            checkoutLoading={checkoutLoading}
            onCheckout={handleCheckout}
            features={[
              `${PLANS.business.dm_limit.toLocaleString()} DMs/month`,
              "Unlimited automations",
              `${PLANS.business.max_accounts} Instagram accounts`,
              "AI Smart Replies",
              "Full analytics + API access",
              "Dedicated support",
            ]}
          />
        </div>

        {/* Agency band — full-width enterprise strip. Agencies typically want
            to negotiate seat counts, white-label branding, and payment terms
            over email, so the primary CTA is "Talk to sales". A secondary
            "Subscribe now" link routes through the same Razorpay flow for
            buyers who want to self-serve without a call. */}
        <div className="mt-8 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 border border-gray-700 p-8 sm:p-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold text-white">Agency</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-gray-300 mb-4">
                Unlimited DMs, unlimited accounts, white-label branding, and a
                dedicated account manager. Ideal for agencies managing 10+ client
                Instagram handles.
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-200">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> Unlimited DMs
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> Unlimited accounts
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> White-label
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> Dedicated manager
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-3 min-w-fit">
              <div className="text-center lg:text-right">
                <div className="text-3xl font-bold text-white">
                  {PLANS.agency.price_label}
                  <span className="text-base font-normal text-gray-400 ml-1">
                    /month
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  or custom pricing on annual
                </div>
              </div>
              <a
                href="mailto:dmshiyamofficial@gmail.com?subject=Agency%20plan%20enquiry&body=Hi%20DM%20Shiyam%20team%2C%0A%0AI%27m%20interested%20in%20the%20Agency%20plan.%20A%20few%20details%20about%20us%3A%0A%0AAgency%20name%3A%0A%23%20of%20client%20IG%20accounts%3A%0AExpected%20monthly%20DM%20volume%3A%0AWebsite%3A%0A%0AThanks!"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition"
              >
                Talk to sales
              </a>
              <button
                onClick={() => handleCheckout("agency")}
                disabled={currentPlan === "agency" || checkoutLoading === "agency"}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-gray-600 text-gray-200 font-medium hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentPlan === "agency"
                  ? "Current Plan"
                  : checkoutLoading === "agency"
                    ? "Loading…"
                    : "or subscribe now"}
              </button>
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
                <th className="text-center py-4 px-4 font-semibold text-gray-900 dark:text-white">
                  Starter
                </th>
                <th className="text-center py-4 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                  Pro
                </th>
                <th className="text-center py-4 px-4 font-semibold text-gray-900 dark:text-white">
                  Business
                </th>
                <th className="text-center py-4 px-4 font-semibold text-amber-600 dark:text-amber-400">
                  Agency
                </th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow
                feature="DMs / month"
                free="500"
                starter="5,000"
                pro="25,000"
                business="100,000"
                agency="Unlimited"
              />
              <ComparisonRow
                feature="Automations"
                free="2"
                starter="10"
                pro="Unlimited"
                business="Unlimited"
                agency="Unlimited"
              />
              <ComparisonRow
                feature="Instagram Accounts"
                free="1"
                starter="1"
                pro="3"
                business="10"
                agency="Unlimited"
              />
              <ComparisonRow
                feature="AI Smart Replies"
                free="❌"
                starter="❌"
                pro="✅"
                business="✅"
                agency="✅"
              />
              <ComparisonRow
                feature="Analytics"
                free="❌"
                starter="Basic"
                pro="Advanced"
                business="Full + Reporting"
                agency="Full + Reporting"
              />
              <ComparisonRow
                feature="DM Templates"
                free="Basic"
                starter="Basic"
                pro="Custom"
                business="Custom + Library"
                agency="Custom + Library"
              />
              <ComparisonRow
                feature="API Access"
                free="❌"
                starter="❌"
                pro="❌"
                business="✅"
                agency="✅"
              />
              <ComparisonRow
                feature="Webhook Support"
                free="❌"
                starter="❌"
                pro="❌"
                business="✅"
                agency="✅"
              />
              <ComparisonRow
                feature="White-label"
                free="❌"
                starter="❌"
                pro="❌"
                business="❌"
                agency="✅"
              />
              <ComparisonRow
                feature="Support"
                free="Community"
                starter="Email"
                pro="Priority Email"
                business="Dedicated"
                agency="Dedicated Manager"
              />
              <ComparisonRow
                feature="Monthly Reports"
                free="❌"
                starter="❌"
                pro="❌"
                business="✅"
                agency="✅"
              />
              <ComparisonRow
                feature="Custom Integrations"
                free="❌"
                starter="❌"
                pro="❌"
                business="✅"
                agency="✅"
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
  starter,
  pro,
  business,
  agency,
}: {
  feature: string;
  free: string;
  starter: string;
  pro: string;
  business: string;
  agency: string;
}) {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      <td className="py-4 px-4 font-medium text-gray-900 dark:text-white">
        {feature}
      </td>
      <td className="py-4 px-4 text-center text-gray-700 dark:text-gray-300">
        {free}
      </td>
      <td className="py-4 px-4 text-center text-gray-700 dark:text-gray-300">
        {starter}
      </td>
      <td className="py-4 px-4 text-center text-gray-700 dark:text-gray-300 bg-indigo-50 dark:bg-indigo-900/20">
        {pro}
      </td>
      <td className="py-4 px-4 text-center text-gray-700 dark:text-gray-300">
        {business}
      </td>
      <td className="py-4 px-4 text-center text-gray-700 dark:text-gray-300">
        {agency}
      </td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────────────
// PricingCard — one reusable card for Free / Starter / Pro / Business.
// Agency has its own bespoke enterprise band above so it's not represented
// here. Extracted from the previous inline JSX so all four cards share
// identical spacing, button states, and current-plan handling — earlier
// each card was a hand-rolled div and drifted (Free was missing the
// disabled state, Business had a different button color scheme, etc.).
// ────────────────────────────────────────────────────────────────────────

function PricingCard({
  plan,
  tagline,
  priceSuffix,
  features,
  excludedFeatures = [],
  isAuthed,
  currentPlan,
  checkoutLoading,
  onCheckout,
  popular,
}: {
  plan: "free" | "starter" | "pro" | "business";
  tagline: string;
  priceSuffix: string;
  features: string[];
  excludedFeatures?: string[];
  isAuthed: boolean;
  currentPlan: string;
  checkoutLoading: string | null;
  onCheckout: (p: "starter" | "pro" | "business" | "agency") => void;
  popular?: boolean;
}) {
  const p = PLANS[plan];
  const isCurrent = isAuthed && currentPlan === plan;
  const isLoading = checkoutLoading === plan;
  const isFree = plan === "free";

  // Button visual style differs per tier so the buyer's eye lands on Pro.
  // Pro = solid indigo (primary), Business = dark slate (secondary),
  // Starter = outlined indigo (tertiary), Free = neutral (utility).
  const buttonClass = popular
    ? "bg-indigo-600 text-white hover:bg-indigo-700"
    : plan === "business"
      ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100"
      : plan === "starter"
        ? "border-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600";

  const buttonLabel = isCurrent
    ? "Current Plan"
    : isLoading
      ? "Loading…"
      : isFree
        ? isAuthed
          ? "Go to Dashboard"
          : "Sign up free"
        : isAuthed
          ? `Upgrade to ${p.name}`
          : `Get Started with ${p.name}`;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-6 sm:p-8 relative flex flex-col ${
        popular
          ? "border-indigo-600 shadow-lg lg:scale-[1.02]"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      {popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-semibold whitespace-nowrap">
            POPULAR
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
          {p.name}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">{tagline}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold text-gray-900 dark:text-white">
          {p.price_label}
        </span>
        <span className="text-gray-600 dark:text-gray-400 ml-2">
          {priceSuffix}
        </span>
      </div>

      {isFree ? (
        isCurrent ? (
          <button
            disabled
            className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg mb-8 cursor-not-allowed"
          >
            Current Plan
          </button>
        ) : (
          <Link
            href={isAuthed ? "/dashboard" : "/register"}
            className={`block text-center w-full py-3 px-4 font-semibold rounded-lg mb-8 transition-colors ${buttonClass}`}
          >
            {buttonLabel}
          </Link>
        )
      ) : (
        <button
          onClick={() => onCheckout(plan as "starter" | "pro" | "business")}
          disabled={isCurrent || isLoading}
          className={`w-full py-3 px-4 font-semibold rounded-lg mb-8 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${buttonClass}`}
        >
          {buttonLabel}
        </button>
      )}

      <div className="space-y-3 flex-1">
        {features.map((f) => (
          <FeatureItem key={f} included>
            {f}
          </FeatureItem>
        ))}
        {excludedFeatures.map((f) => (
          <FeatureItem key={f}>{f}</FeatureItem>
        ))}
      </div>
    </div>
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