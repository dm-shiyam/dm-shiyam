// components/PricingContent.tsx — Client Component with all pricing logic

"use client";

import Link from "next/link";
import { useState } from "react";

export default function PricingContent() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );

  const handleCheckout = (plan: "pro" | "business") => {
    // Replace with your actual Razorpay key and plan details
    const amount = plan === "pro" ? 9900 : 99900; // in paise (INR 99 or INR 999)
    const planName = plan === "pro" ? "DM Shiyam Pro" : "DM Shiyam Business";

    // Create order on backend
    fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        plan,
        planName,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.subscription_id) {
          // Redirect to Razorpay or handle subscription
          window.location.href = data.shortUrl || "/dashboard";
        } else if (data.error) {
          alert("Error: " + data.error);
        }
      })
      .catch((err) => console.error("Checkout error:", err));
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Free Tier */}
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
                $0
              </span>
              <span className="text-gray-600 dark:text-gray-400 ml-2">
                forever
              </span>
            </div>

            <button
              disabled
              className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg mb-8 cursor-not-allowed"
            >
              Current Plan
            </button>

            <div className="space-y-4">
              <FeatureItem included>5 automations</FeatureItem>
              <FeatureItem included>Basic analytics</FeatureItem>
              <FeatureItem included>1 Instagram account</FeatureItem>
              <FeatureItem included>Community support</FeatureItem>
              <FeatureItem>Advanced features</FeatureItem>
              <FeatureItem>Priority support</FeatureItem>
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
                ₹99
              </span>
              <span className="text-gray-600 dark:text-gray-400 ml-2">
                /month
              </span>
            </div>

            <button
              onClick={() => handleCheckout("pro")}
              className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors mb-8"
            >
              Start Free Trial
            </button>

            <div className="space-y-4">
              <FeatureItem included>50 automations</FeatureItem>
              <FeatureItem included>Advanced analytics</FeatureItem>
              <FeatureItem included>5 Instagram accounts</FeatureItem>
              <FeatureItem included>Priority support</FeatureItem>
              <FeatureItem included>Custom DM templates</FeatureItem>
              <FeatureItem>API access</FeatureItem>
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
                ₹999
              </span>
              <span className="text-gray-600 dark:text-gray-400 ml-2">
                /month
              </span>
            </div>

            <button
              onClick={() => handleCheckout("business")}
              className="w-full py-3 px-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors mb-8"
            >
              Start Free Trial
            </button>

            <div className="space-y-4">
              <FeatureItem included>Unlimited automations</FeatureItem>
              <FeatureItem included>Full analytics & reporting</FeatureItem>
              <FeatureItem included>Unlimited accounts</FeatureItem>
              <FeatureItem included>Dedicated support</FeatureItem>
              <FeatureItem included>Custom DM templates</FeatureItem>
              <FeatureItem included>API access</FeatureItem>
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