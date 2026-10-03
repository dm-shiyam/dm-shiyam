// components/PricingContent.tsx — Client Component with all pricing logic

"use client";

import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { trackEvent, getGaClientId } from "@/lib/analytics";
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
    // Snapshot the cycle at click time so a mid-flight toggle can't
    // desync the GA event / verify call from the subscription actually
    // being created on the server.
    const cycle = billingCycle;
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
    // For yearly, amount === price_yearly (already the "2 months free" total).
    const planConfig = PLANS[plan];
    const amount =
      cycle === "yearly" && planConfig.price_yearly
        ? planConfig.price_yearly
        : planConfig.price_monthly;
    const planName = `DM Shiyam ${planConfig.name}${cycle === "yearly" ? " (Yearly)" : ""}`;

    // GA4 funnel step — checkout_initiated (S5.6.5). Fired at click time,
    // before payment. The real `subscription_started` conversion is fired
    // server-side from the Razorpay webhook once payment is confirmed —
    // see `src/app/api/billing/webhook/route.ts` — so abandoned checkout
    // modals don't inflate the conversion count.
    trackEvent({
      name: "checkout_initiated",
      params: { plan, cycle, amount, currency: "INR" },
    });

    // Capture GA4's client_id so the server-side conversion (fired later
    // from the webhook, with no browser available) can still attribute
    // back to this session's acquisition channel/campaign.
    const gaClientId = await getGaClientId();

    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, plan, planName, cycle, ga_client_id: gaClientId }),
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
                cycle,
              }),
            });
            if (verifyRes.ok) {
              // Success — land on dashboard with a query param the client
              // can pick up to show a "Welcome to Pro" toast.
              window.location.href = "/dashboard?subscribed=" + plan;
            } else {
              const err = await verifyRes.json().catch(() => ({}));
              alert(
                "Your payment went through, but we couldn't confirm it right away (" +
                  (err.error || "unknown") +
                  "). Please refresh this page in a minute — your account will update automatically."
              );
            }
          } catch (err) {
            console.error("[checkout] verify failed:", err);
            alert(
              "Payment received! Please refresh this page in a moment — your account will update automatically."
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

      {/* Nav — identical shape to LandingContent so the brand reads
          consistently between pages (same logo tile, same pill links,
          same gradient CTA). */}
      <nav className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-xl dark:border-gray-800/60 dark:bg-gray-950/80">
        <div className="section flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="logo-tile h-9 w-9 overflow-hidden">
              <Image
                src="/logo.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 object-cover"
                priority
              />
            </span>
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              DM Shiyam
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="hidden sm:inline-flex rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/blog"
              className="hidden sm:inline-flex rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Blog
            </Link>
            {isAuthed ? (
              <>
                <span className="hidden lg:inline max-w-[180px] truncate text-xs text-gray-500 dark:text-gray-400">
                  {session?.user?.email}
                </span>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1 rounded-full bg-ig-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-strong"
                >
                  Dashboard →
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1 rounded-full bg-ig-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-strong"
                >
                  Start free →
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero — gradient wash + gradient-text headline, consistent with
          the landing hero but visually distinct (no inline product mock,
          no social-proof strip; those live on /). */}
      <section className="relative overflow-hidden bg-hero-glow">
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-pink-200/30 blur-3xl dark:bg-pink-900/20" />
        <div className="section py-20 sm:py-24">
          <div className="mx-auto max-w-3xl text-center animate-fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/80 px-4 py-1.5 text-xs font-medium text-gray-700 shadow-soft backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Transparent pricing · GST invoices · UPI & cards
            </div>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-gray-900 sm:text-6xl dark:text-white">
              Scale on your terms,{" "}
              <span className="gradient-text">pay only when you grow</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
              Start free with 500 DMs/month, forever. Upgrade only when you
              need more — no contracts, cancel anytime, GST-compliant invoices.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards Section — 4 self-serve tiers in a responsive grid.
          Agency (unlimited) lives in its own band below because it's usually
          a conversation (custom seat counts, white-label branding) rather
          than a Razorpay click. */}
      <section className="section pb-10">
        {/* Billing cycle toggle — monthly (default) vs yearly. Promoted
            above the cards with a card-style container + 2-months-free
            green pill on the yearly tab so the saving signals clearly. */}
        <div className="mb-14 flex flex-col items-center">
          <div
            role="tablist"
            aria-label="Billing cycle"
            className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-soft dark:border-gray-800 dark:bg-gray-900"
          >
            <button
              role="tab"
              aria-selected={billingCycle === "monthly"}
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                billingCycle === "monthly"
                  ? "bg-gray-900 text-white shadow-medium dark:bg-white dark:text-gray-900"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              role="tab"
              aria-selected={billingCycle === "yearly"}
              onClick={() => setBillingCycle("yearly")}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                billingCycle === "yearly"
                  ? "bg-gray-900 text-white shadow-medium dark:bg-white dark:text-gray-900"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              Yearly
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  billingCycle === "yearly"
                    ? "bg-emerald-200 text-emerald-800"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                }`}
              >
                2 MONTHS FREE
              </span>
            </button>
          </div>
          {billingCycle === "yearly" && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Save ~17% — pay for 10 months, get 12.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Free Tier */}
          <PricingCard
            plan="free"
            tagline="Perfect for getting started"
            billingCycle={billingCycle}
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
            billingCycle={billingCycle}
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
            billingCycle={billingCycle}
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

          {/* Business Tier — 2026-09-11: "API access" moved to Coming Q1 2027
              in the comparison table (not shipped yet). Card now leads with
              CSV export, which IS live via /api/analytics/export. */}
          <PricingCard
            plan="business"
            tagline="For teams & bigger brands"
            billingCycle={billingCycle}
            isAuthed={isAuthed}
            currentPlan={currentPlan}
            checkoutLoading={checkoutLoading}
            onCheckout={handleCheckout}
            features={[
              `${PLANS.business.dm_limit.toLocaleString()} DMs/month`,
              "Unlimited automations",
              `${PLANS.business.max_accounts} Instagram accounts`,
              "AI Smart Replies",
              "Full analytics + CSV export",
              "Dedicated support",
            ]}
          />
        </div>

        {/* Agency band — enterprise strip. 2026-09-11: intentionally
            "Talk to sales" only (no self-serve Razorpay button). The Agency
            headline feature — white-label branding, custom domain, per-tenant
            SMTP — is on the Q1 2027 roadmap, not shipped yet. Selling Agency
            self-serve today would set the wrong expectation. Sales conversations
            let us scope the deal and give a real ETA on white-label. Once
            white-label ships we'll re-enable the "or subscribe now" button. */}
        <div className="relative mt-10 overflow-hidden rounded-3xl bg-gray-900 p-8 shadow-strong sm:p-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-60 bg-ig-gradient"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-grid-light bg-grid-20 opacity-20"
            aria-hidden
          />
          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h3 className="text-3xl font-bold tracking-tight text-white">
                  Agency
                </h3>
                <span className="rounded-full border border-amber-400/50 bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
                  ENTERPRISE
                </span>
                <span className="rounded-full border border-white/40 bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                  EARLY ACCESS
                </span>
              </div>
              <p className="mb-5 max-w-2xl text-base leading-relaxed text-white/90">
                Everything in Business, plus unlimited DMs, unlimited Instagram
                accounts, a dedicated account manager, and{" "}
                <span className="font-semibold text-white underline decoration-white/40 underline-offset-4">
                  early access to white-label branding
                </span>{" "}
                (Q1 2027). Ideal for agencies managing 10+ client handles.
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/90">
                <AgencyCheck>Unlimited DMs</AgencyCheck>
                <AgencyCheck>Unlimited accounts</AgencyCheck>
                <AgencyCheck>CSV export</AgencyCheck>
                <AgencyCheck>Dedicated manager</AgencyCheck>
                <span className="inline-flex items-center gap-1.5 text-amber-200">
                  <span>◔</span> White-label · Q1 2027
                </span>
              </div>
            </div>
            <div className="flex min-w-fit flex-col items-stretch gap-3 lg:min-w-[240px]">
              <div className="text-center lg:text-right">
                <div className="text-4xl font-bold tracking-tight text-white">
                  From {PLANS.agency.price_label}
                  <span className="ml-1 text-base font-normal text-white/70">
                    /month
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/70">
                  Custom pricing on annual & bulk
                </div>
              </div>
              <a
                href="mailto:dmshiyamofficial@gmail.com?subject=Agency%20plan%20enquiry&body=Hi%20DM%20Shiyam%20team%2C%0A%0AI%27m%20interested%20in%20the%20Agency%20plan.%20A%20few%20details%20about%20us%3A%0A%0AAgency%20name%3A%0A%23%20of%20client%20IG%20accounts%3A%0AExpected%20monthly%20DM%20volume%3A%0AWebsite%3A%0AInterested%20in%20white-label%20early%20access%3F%20(Y%2FN)%3A%0A%0AThanks!"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-strong transition-all hover:scale-[1.02]"
              >
                Talk to sales →
              </a>
              <span className="text-center text-xs text-white/70">
                We reply within 24 hours
              </span>
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
              {/* Comparison rows below are the SHIP-STATE truth as of the
                  2026-09-11 audit. Anything marked ✅ is live in production
                  today; "Coming …" rows are known-planned features that were
                  previously oversold as ✅ and are now honestly labelled. */}
              <ComparisonRow
                feature="Analytics dashboard"
                free="❌"
                starter="✅"
                pro="✅"
                business="✅"
                agency="✅"
              />
              <ComparisonRow
                feature="CSV data export"
                free="❌"
                starter="❌"
                pro="❌"
                business="✅"
                agency="✅"
              />
              <ComparisonRow
                feature="Monthly PDF reports"
                free="❌"
                starter="❌"
                pro="❌"
                business="Coming Q1 2027"
                agency="Coming Q1 2027"
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
                business="Coming Q1 2027"
                agency="Coming Q1 2027"
              />
              <ComparisonRow
                feature="Webhook Support"
                free="❌"
                starter="❌"
                pro="❌"
                business="Coming Q1 2027"
                agency="Coming Q1 2027"
              />
              <ComparisonRow
                feature="White-label branding"
                free="❌"
                starter="❌"
                pro="❌"
                business="❌"
                agency="Coming Q1 2027"
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
                feature="Custom Integrations"
                free="❌"
                starter="❌"
                pro="❌"
                business="On request"
                agency="On request"
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 py-24 sm:py-32 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
              Questions, <span className="gradient-text">straight answers</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Everything you need to know before upgrading.
            </p>
          </div>

          <div className="space-y-3">
            <FAQItem
              question="Can I upgrade or downgrade anytime?"
              answer="Yes, anytime. When you upgrade, your new plan starts right away and you get more DMs instantly. When you downgrade, your current plan keeps running until it ends — so you don't lose any days you've already paid for."
            />
            <FAQItem
              question="How do I cancel my subscription?"
              answer="You can cancel anytime — no questions asked. Just open your dashboard and click Cancel subscription in the plan menu (top-right). Your plan stays active until the end of the billing cycle you've already paid for, and you won't be charged again. No cancellation fees, no lock-in. Prefer to cancel by email? Write to dmshiyamofficial@gmail.com and we'll handle it within 24 hours."
            />
            <FAQItem
              question="Do you offer refunds?"
              answer="Yes. Full refund within 7 days of your first paid charge — no questions asked. For renewals, email dmshiyamofficial@gmail.com within 72 hours and we'll review case-by-case (and almost always refund if you didn't use the plan). Full details and timelines are on our Refund & Cancellation Policy page: /refund-policy"
            />
            <FAQItem
              question="Is there a free trial?"
              answer="Yes! The Free plan gives you 500 DMs every month, forever — no credit card needed. Try it out and see how it works for your audience. Most creators only upgrade once they run out of free DMs."
            />
            <FAQItem
              question="What happens if I exceed my plan limits?"
              answer="We'll email you and show a warning banner in your dashboard once you've used 80% of your monthly DMs. If you finish them all, DM Shiyam simply pauses until your next month starts on the 1st — or you can upgrade anytime for more DMs instantly. We'll never send extra DMs and surprise you with a bigger bill."
            />
            <FAQItem
              question="Is this Instagram-safe? Will my account get banned?"
              answer="100% safe. We use Instagram's official partner system (approved by Meta, the company behind Instagram) — we never log into your account or use any shady tricks. We also stay well within Instagram's daily limits so your account always looks natural. Not a single DM Shiyam user has ever been banned or restricted."
            />
            <FAQItem
              question="Do I need an Instagram Business or Creator account?"
              answer="Yes. Instagram only allows auto-DMs from Business or Creator accounts (not personal ones). Switching is free and takes 30 seconds — in the Instagram app, go to Settings → Account → Switch to Professional Account. You'll also need to connect it to a Facebook Page, and we'll guide you through every step."
            />
            <FAQItem
              question="Do prices include GST?"
              answer="Prices shown are exclusive of GST. 18% GST is added at checkout and appears on your invoice."
            />
            <FAQItem
              question="What payment methods do you accept?"
              answer="You can pay using UPI (GPay, PhonePe, Paytm), any Indian debit or credit card, net banking, or popular wallets — all securely processed through Razorpay."
            />
            <FAQItem
              question="Can I connect multiple Instagram accounts?"
              answer="Yes! Starter includes 1 account, Pro includes 3, Business includes 10, and Agency has no limit. Each account gets its own DMs and setup, and you can manage all of them from one simple dashboard."
            />
            <FAQItem
              question="Can I use AI-generated replies?"
              answer="Yes — Pro, Business, and Agency plans include AI Smart Replies. Our AI reads each comment and writes a personal reply in your own style, so every DM feels like you wrote it yourself. Free and Starter plans use ready-made message templates instead."
            />
            <FAQItem
              question="What if my Instagram connection breaks?"
              answer="Don't worry — we keep your Instagram connection active automatically in the background, so you never have to think about it. If anything ever goes wrong (like if you accidentally disconnected the app), you'll get an email with a one-click link to reconnect. No technical setup needed."
            />
            <FAQItem
              question="Do you offer discounts for annual billing?"
              answer="Yearly plans are launching in late 2026 with a 20% discount — that's nearly 2.5 months free. Existing monthly subscribers get first access, so subscribe now to lock in the early-bird discount."
            />
          </div>
        </div>
      </section>

      {/* CTA Section — mirrors the landing CTA for brand consistency */}
      <section className="section pb-24 pt-10 sm:pb-32">
        <div className="relative overflow-hidden rounded-3xl bg-gray-900 p-10 text-center shadow-strong sm:p-16">
          <div className="pointer-events-none absolute inset-0 opacity-80 bg-ig-gradient" aria-hidden />
          <div className="pointer-events-none absolute inset-0 bg-grid-light bg-grid-20 opacity-20" aria-hidden />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Ready to turn comments into conversations?
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-lg text-white/90">
              Start free with 500 DMs/month. No credit card, no time limit —
              upgrade only when you outgrow it.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-gray-900 shadow-strong transition-all hover:scale-[1.02]"
            >
              Get started free →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer — identical to LandingContent so cross-page brand is consistent */}
      <footer className="border-t border-gray-100 bg-white py-14 dark:border-gray-800 dark:bg-gray-950">
        <div className="section">
          <div className="mb-10 grid grid-cols-2 gap-10 md:grid-cols-4">
            <div className="col-span-2">
              <Link href="/" className="mb-4 inline-flex items-center gap-2.5">
                <span className="logo-tile h-9 w-9 overflow-hidden">
                  <Image
                    src="/logo.png"
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 object-cover"
                  />
                </span>
                <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                  DM Shiyam
                </span>
              </Link>
              <p className="max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Turn Instagram comments into personal DMs. Fully automated,
                Meta-approved, built for Indian creators.
              </p>
            </div>
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
                Product
              </h4>
              <ul className="space-y-2.5 text-sm text-gray-500 dark:text-gray-400">
                <li>
                  <Link href="/" className="transition-colors hover:text-gray-900 dark:hover:text-white">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="transition-colors hover:text-gray-900 dark:hover:text-white">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="transition-colors hover:text-gray-900 dark:hover:text-white">
                    Blog
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
                Legal
              </h4>
              <ul className="space-y-2.5 text-sm text-gray-500 dark:text-gray-400">
                <li>
                  <Link href="/privacy" className="transition-colors hover:text-gray-900 dark:hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="transition-colors hover:text-gray-900 dark:hover:text-white">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:dmshiyamofficial@gmail.com"
                    className="transition-colors hover:text-gray-900 dark:hover:text-white"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-6 text-center text-sm text-gray-400 dark:border-gray-800">
            © {new Date().getFullYear()} DM Shiyam. All rights reserved.
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
    <div className="flex items-start gap-3 text-sm">
      {included ? (
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-700"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span
        className={
          included
            ? "text-gray-700 dark:text-gray-300"
            : "text-gray-400 line-through dark:text-gray-600"
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
  billingCycle,
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
  billingCycle: "monthly" | "yearly";
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

  // Free tier ignores the toggle (always "forever"). Paid tiers with a
  // yearly price defined swap in the yearly label + suffix when the
  // toggle is on; if a tier has no yearly price configured yet, we
  // gracefully fall back to the monthly display.
  const showYearly =
    !isFree && billingCycle === "yearly" && !!p.price_yearly && !!p.price_label_yearly;
  const priceLabel = showYearly ? p.price_label_yearly! : p.price_label;
  const priceSuffix = isFree
    ? "forever"
    : showYearly
      ? "/year"
      : "/month";
  // Effective monthly cost when paying yearly — helps the buyer compare
  // apples-to-apples without a calculator. Rendered as small helper text
  // below the headline price (only in yearly mode).
  const effectiveMonthlyPaise = showYearly ? Math.round(p.price_yearly! / 12) : null;
  const effectiveMonthlyLabel =
    effectiveMonthlyPaise !== null
      ? `₹${Math.round(effectiveMonthlyPaise / 100).toLocaleString("en-IN")}`
      : null;

  // Button visual language — Pro (popular) gets the full brand gradient
  // button so the eye lands there; Business the dark slate anchor,
  // Starter a subtle outlined pill, Free a neutral utility button.
  const buttonClass = popular
    ? "bg-ig-gradient bg-[length:200%_200%] text-white shadow-strong hover:bg-[position:100%_0] hover:shadow-glow"
    : plan === "business"
      ? "bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      : plan === "starter"
        ? "border-2 border-pink-200 bg-white text-pink-700 hover:border-pink-300 hover:bg-pink-50 dark:border-pink-900/40 dark:bg-gray-900 dark:text-pink-300 dark:hover:bg-pink-950/40"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";

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
      className={`relative flex flex-col rounded-2xl p-7 transition-all sm:p-8 ${
        popular
          ? "border border-transparent bg-white shadow-strong [background:linear-gradient(white,white)_padding-box,linear-gradient(135deg,#f09433,#dc2743,#bc1888)_border-box] lg:-translate-y-2 dark:bg-gray-900 dark:[background:linear-gradient(rgb(17_24_39),rgb(17_24_39))_padding-box,linear-gradient(135deg,#f09433,#dc2743,#bc1888)_border-box] [border-width:2px]"
          : "border border-gray-200 bg-white shadow-soft hover:-translate-y-0.5 hover:shadow-medium dark:border-gray-800 dark:bg-gray-900"
      }`}
    >
      {popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-ig-gradient px-3.5 py-1 text-xs font-semibold text-white shadow-glow">
            ★ POPULAR
          </span>
        </div>
      )}

      <div className="mb-5">
        <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          {p.name}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tagline}
        </p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            {priceLabel}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {priceSuffix}
          </span>
        </div>
        {effectiveMonthlyLabel && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            ≈ {effectiveMonthlyLabel}/mo · billed annually
          </p>
        )}
      </div>

      {isFree ? (
        isCurrent ? (
          <button
            disabled
            className="mb-7 w-full cursor-not-allowed rounded-full bg-gray-100 py-3 px-4 text-sm font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            Current Plan
          </button>
        ) : (
          <Link
            href={isAuthed ? "/dashboard" : "/register"}
            className={`mb-7 block w-full rounded-full py-3 px-4 text-center text-sm font-semibold transition-all ${buttonClass}`}
          >
            {buttonLabel}
          </Link>
        )
      ) : (
        <button
          onClick={() => onCheckout(plan as "starter" | "pro" | "business")}
          disabled={isCurrent || isLoading}
          className={`mb-7 w-full rounded-full py-3 px-4 text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${buttonClass}`}
        >
          {buttonLabel}
        </button>
      )}

      <div className="flex-1 space-y-2.5 border-t border-gray-100 pt-6 dark:border-gray-800">
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

function AgencyCheck({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg
        className="h-4 w-4 text-emerald-300"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
          clipRule="evenodd"
        />
      </svg>
      {children}
    </span>
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
    <div
      className={`rounded-2xl border bg-white p-6 transition-all dark:bg-gray-900 ${
        open
          ? "border-gray-200 shadow-medium dark:border-gray-800"
          : "border-gray-200 dark:border-gray-800"
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-6 text-left font-semibold text-gray-900 dark:text-white"
      >
        <span className="text-base sm:text-lg">{question}</span>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
            open
              ? "rotate-45 bg-ig-gradient text-white"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          +
        </span>
      </button>
      {open && (
        <p className="mt-4 leading-relaxed text-gray-600 dark:text-gray-400">
          {answer}
        </p>
      )}
    </div>
  );
}