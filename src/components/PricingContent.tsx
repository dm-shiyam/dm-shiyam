// components/PricingContent.tsx — Client Component with all pricing logic

"use client";

import Link from "next/link";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { PLANS } from "@/lib/plans";
import type { PlanConfig, PlanType } from "@/types";

type PaidPlan = Exclude<PlanType, "free">;

export default function PricingContent() {
  const [loadingPlan, setLoadingPlan] = useState<PaidPlan | null>(null);

  const handleCheckout = async (plan: PaidPlan) => {
    const planConfig = PLANS[plan];
    setLoadingPlan(plan);

    // GA4 conversion — V13.4 subscription_started (checkout intent).
    // Fired here (before Razorpay redirect) because the hosted checkout page
    // takes over the browser session and we lose the opportunity to fire it
    // after payment succeeds. The actual "paid" event is tracked server-side
    // via the Razorpay webhook (see `src/app/api/billing/webhook/route.ts`).
    trackEvent({
      name: "subscription_started",
      params: {
        plan,
        amount: planConfig.price_monthly,
        currency: "INR",
      },
    });

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/pricing")}`;
        return;
      }

      const data = await res.json();

      if (data.short_url) {
        window.location.href = data.short_url;
      } else if (data.error) {
        alert(`Unable to start checkout: ${data.error}`);
      } else {
        alert("Checkout URL missing from response. Please contact support.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            DM Shiyam
          </Link>
          <div className="flex gap-4">
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Free Tier */}
          <PricingCard
            plan={PLANS.free}
            cta="Get Started Free"
            ctaHref="/register"
            variant="default"
          />

          {/* Starter Tier */}
          <PricingCard
            plan={PLANS.starter}
            cta={loadingPlan === "starter" ? "Redirecting…" : "Choose Starter"}
            onCtaClick={() => handleCheckout("starter")}
            disabled={loadingPlan !== null}
            variant="default"
            tagline="For solo creators"
          />

          {/* Pro Tier — POPULAR */}
          <PricingCard
            plan={PLANS.pro}
            cta={loadingPlan === "pro" ? "Redirecting…" : "Choose Pro"}
            onCtaClick={() => handleCheckout("pro")}
            disabled={loadingPlan !== null}
            variant="popular"
            tagline="AI-powered growth"
          />

          {/* Business Tier — contact sales until Razorpay plan created */}
          <PricingCard
            plan={PLANS.business}
            cta="Contact Sales"
            ctaHref="mailto:dmshiyamofficial@gmail.com?subject=Business%20Plan%20Enquiry"
            variant="default"
            tagline="Agencies & brands"
          />
        </div>

        {/* Agency callout */}
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 dark:bg-gray-900">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Need white-label & unlimited everything?
            </h4>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Agency plan starts at {PLANS.agency.price_label}/month — includes dedicated account manager and white-label option.
            </p>
          </div>
          <a
            href="mailto:dmshiyamofficial@gmail.com?subject=Agency%20Plan%20Enquiry"
            className="whitespace-nowrap px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Talk to Sales
          </a>
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
              </tr>
            </thead>
            <tbody>
              <ComparisonRow feature="DMs / month" free="500" starter="5,000" pro="25,000" business="100,000" />
              <ComparisonRow feature="Automations" free="2" starter="10" pro="Unlimited" business="Unlimited" />
              <ComparisonRow feature="Instagram Accounts" free="1" starter="1" pro="3" business="10" />
              <ComparisonRow feature="Analytics Dashboard" free="❌" starter="✅" pro="✅ Full" business="✅ Full + Reports" />
              <ComparisonRow feature="AI Smart Replies" free="❌" starter="❌" pro="✅" business="✅" />
              <ComparisonRow feature="Custom DM Templates" free="Basic" starter="✅" pro="✅" business="✅ + Library" />
              <ComparisonRow feature="API Access" free="❌" starter="❌" pro="❌" business="✅" />
              <ComparisonRow feature="Webhook Support" free="❌" starter="❌" pro="❌" business="✅" />
              <ComparisonRow feature="Support" free="Community" starter="Email" pro="Priority" business="Dedicated" />
              <ComparisonRow feature="Custom Integrations" free="❌" starter="❌" pro="❌" business="✅" />
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
              answer="Yes! You can upgrade or downgrade your plan anytime. Changes take effect immediately, and we'll prorate your billing."
            />
            <FAQItem
              question="Is there a long-term contract?"
              answer="No contracts. All plans are month-to-month. Cancel anytime from your account settings."
            />
            <FAQItem
              question="Do you offer discounts for annual billing?"
              answer="Currently, all plans are monthly. Annual plans are coming soon — stay tuned!"
            />
            <FAQItem
              question="What happens if I exceed my plan limits?"
              answer="We'll notify you when you're approaching limits. You can upgrade anytime to increase your quota."
            />
            <FAQItem
              question="Do you offer refunds?"
              answer="We offer a 7-day money-back guarantee. Contact us at dmshiyamofficial@gmail.com for refund requests."
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
            Start your free 14-day trial today. No credit card required.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-white text-indigo-600 font-bold rounded-lg hover:bg-gray-100 transition-colors text-lg"
          >
            Start Free Trial
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
}: {
  feature: string;
  free: string;
  starter: string;
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
      <td className="py-4 px-4 text-center text-gray-700 dark:text-gray-300">
        {starter}
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

function PricingCard({
  plan,
  cta,
  onCtaClick,
  ctaHref,
  disabled,
  variant,
  tagline,
}: {
  plan: PlanConfig;
  cta: string;
  onCtaClick?: () => void;
  ctaHref?: string;
  disabled?: boolean;
  variant: "default" | "popular";
  tagline?: string;
}) {
  const isPopular = variant === "popular";
  const cardClasses = isPopular
    ? "bg-white dark:bg-gray-800 rounded-xl border-2 border-indigo-600 p-6 relative shadow-lg"
    : "bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6";
  const buttonClasses = isPopular
    ? "w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors mb-6 disabled:opacity-60 disabled:cursor-not-allowed"
    : "w-full py-3 px-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-lg hover:opacity-90 transition-opacity mb-6 disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className={cardClasses}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
            MOST POPULAR
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {plan.name}
        </h3>
        {tagline && (
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            {tagline}
          </p>
        )}
      </div>

      <div className="mb-6">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">
          {plan.price_label}
        </span>
        <span className="text-gray-600 dark:text-gray-400 ml-1 text-sm">
          {plan.price_monthly === 0 ? "forever" : "/month"}
        </span>
      </div>

      {ctaHref ? (
        <a
          href={ctaHref}
          className={buttonClasses + " text-center inline-block"}
        >
          {cta}
        </a>
      ) : (
        <button
          onClick={onCtaClick}
          disabled={disabled}
          className={buttonClasses}
        >
          {cta}
        </button>
      )}

      <div className="space-y-3">
        {plan.features.map((feature: string) => (
          <FeatureItem key={feature} included>
            {feature}
          </FeatureItem>
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