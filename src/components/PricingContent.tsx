// components/PricingContent.tsx — Client Component with all pricing logic

"use client";

import Link from "next/link";
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

    // GA4 funnel step — checkout_initiated (S5.6.5). Fired at click time,
    // before payment. The real `subscription_started` conversion is fired
    // server-side from the Razorpay webhook once payment is confirmed —
    // see `src/app/api/billing/webhook/route.ts` — so abandoned checkout
    // modals don't inflate the conversion count.
    trackEvent({
      name: "checkout_initiated",
      params: { plan, amount, currency: "INR" },
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
        body: JSON.stringify({ amount, plan, planName, ga_client_id: gaClientId }),
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

          {/* Business Tier — 2026-09-11: "API access" moved to Coming Q1 2027
              in the comparison table (not shipped yet). Card now leads with
              CSV export, which IS live via /api/analytics/export. */}
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
        <div className="mt-8 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 border border-gray-700 p-8 sm:p-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h3 className="text-2xl font-bold text-white">Agency</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ENTERPRISE
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  EARLY ACCESS
                </span>
              </div>
              <p className="text-gray-300 mb-4">
                Everything in Business, plus unlimited DMs, unlimited Instagram
                accounts, a dedicated account manager, and{" "}
                <span className="text-white font-semibold">
                  early access to white-label branding
                </span>{" "}
                (Q1 2027). Ideal for agencies managing 10+ client handles.
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-200">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> Unlimited DMs
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> Unlimited accounts
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> CSV export
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> Dedicated manager
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-300">
                  <span>◔</span> White-label · Q1 2027
                </span>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-3 min-w-fit lg:min-w-[220px]">
              <div className="text-center lg:text-right">
                <div className="text-3xl font-bold text-white">
                  From {PLANS.agency.price_label}
                  <span className="text-base font-normal text-gray-400 ml-1">
                    /month
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Custom pricing on annual & bulk
                </div>
              </div>
              <a
                href="mailto:dmshiyamofficial@gmail.com?subject=Agency%20plan%20enquiry&body=Hi%20DM%20Shiyam%20team%2C%0A%0AI%27m%20interested%20in%20the%20Agency%20plan.%20A%20few%20details%20about%20us%3A%0A%0AAgency%20name%3A%0A%23%20of%20client%20IG%20accounts%3A%0AExpected%20monthly%20DM%20volume%3A%0AWebsite%3A%0AInterested%20in%20white-label%20early%20access%3F%20(Y%2FN)%3A%0A%0AThanks!"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition"
              >
                Talk to sales
              </a>
              <span className="text-xs text-gray-500 text-center">
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
      <section className="bg-gray-50 dark:bg-gray-900 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <FAQItem
              question="Can I upgrade or downgrade anytime?"
              answer="Yes, anytime. When you upgrade, your new plan starts right away and you get more DMs instantly. When you downgrade, your current plan keeps running until it ends — so you don't lose any days you've already paid for."
            />
            <FAQItem
              question="How do I cancel my subscription?"
              answer="Just go to Dashboard → Settings → Subscription and click Cancel. You'll keep using DM Shiyam until your paid month ends. No cancellation fees, no lock-in, no questions asked."
            />
            <FAQItem
              question="Do you offer refunds?"
              answer="If something's not working for you, just email us at dmshiyamofficial@gmail.com. Tell us what went wrong and we'll sort it out — we handle every refund personally and always try to make things right."
            />
            <FAQItem
              question="Is there a free trial?"
              answer="Yes! The Free plan gives you 500 DMs every month, forever — no credit card needed. Try it out and see how it works for your audience. Most creators only upgrade once they run out of free DMs."
            />
            <FAQItem
              question="What happens if I exceed my plan limits?"
              answer="We'll email you (and show a notification in your dashboard) once you've used 80% of your DMs. If you finish them all, DM Shiyam simply pauses until your next month starts on the 1st — or you can upgrade anytime for more DMs instantly. We'll never send extra DMs and surprise you with a bigger bill."
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