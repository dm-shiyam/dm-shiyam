// components/LandingContent.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function LandingContent() {
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [ctaDismissed, setCtaDismissed] = useState(false);

  // A9.3 follow-up (2026-09-09): navbar was showing Login/Sign Up
  // unconditionally even for authenticated users. Same fix as PricingContent
  // — surface Dashboard link when logged in.
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("dms_sticky_cta_dismissed") === "1") {
      setCtaDismissed(true);
      return;
    }
    const onScroll = () => {
      // Show once user has scrolled roughly past the hero (~600px)
      setShowStickyCta(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dismissCta = () => {
    setCtaDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("dms_sticky_cta_dismissed", "1");
    }
  };

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="text-2xl font-bold text-indigo-600">DM Shiyam</div>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Pricing
            </Link>
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
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Sign up free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center">
          {/* V16 — Landing hero rewrite. Direct-benefit headline that names the
              outcome (comment → DM) and the timeline (30s). Old copy "Automate
              Instagram DMs at Scale" tested weak on cold traffic — it named the
              category but not the payoff. Subline explains the actual mechanic
              in one sentence + ends with the price anchor (₹0). */}
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Turn Instagram comments into DMs in{" "}
            <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
              30 seconds
            </span>
            .
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Every comment on your posts triggers a personalized DM with your link,
            guide, or discount code. Fully automated, Meta-approved,{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              ₹0 to start.
            </span>
          </p>
          {/* CTAs + Meta Tech Provider badge (Task 10.2) */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-6">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors text-center shadow-sm"
            >
              Get Started Free — 500 DMs/month
              <span aria-hidden="true">→</span>
            </Link>

            <div
              title="Meta Tech Provider — approved via Instagram App Review"
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              {/* Meta wordmark (infinity / \u2135) */}
              <svg
                className="w-7 h-7"
                viewBox="0 0 36 24"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="metaGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0064E0" />
                    <stop offset="50%" stopColor="#0082FB" />
                    <stop offset="100%" stopColor="#0081FB" />
                  </linearGradient>
                </defs>
                <path
                  d="M6 18c-2.2 0-4-2.7-4-6s1.8-6 4-6c2.6 0 4.6 2.4 7.2 6.3C15.9 16.4 17.7 18 20 18c2.2 0 4-2.7 4-6s-1.8-6-4-6c-2.3 0-4.1 1.6-6.8 5.7C10.6 15.6 8.6 18 6 18z"
                  stroke="url(#metaGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-left leading-tight">
                <div className="font-semibold text-gray-900 dark:text-white text-base">
                  Meta
                </div>
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Tech Provider
                </div>
              </div>
            </div>

            <Link
              href="#how-it-works"
              className="px-6 py-3 text-gray-700 dark:text-gray-300 font-medium hover:text-gray-900 dark:hover:text-white transition-colors text-center"
            >
              See how it works →
            </Link>
          </div>

          {/* Trust checks */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-12">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
              </svg>
              Meta Approved
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
              </svg>
              No Credit Card
            </span>
            {/* V17 fix — was '14-Day Free Trial'. The free plan is perpetual
                (500 DMs/month forever, not a countdown), so the old copy was
                actively misleading and generated support tickets on day 15. */}
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
              </svg>
              Free forever — 500 DMs/mo
            </span>
          </div>
        </div>

        {/* Hero Image Placeholder */}
        <div className="mt-16 bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900 dark:to-indigo-950 rounded-xl h-96 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
          <div className="text-center">
            <div className="text-6xl mb-4">📱</div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              Instagram automation dashboard preview
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-gray-50 dark:bg-gray-900 py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Powerful Features Built for Growth
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Everything you need to automate, scale, and engage with your Instagram audience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Keyword Triggers
              </h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Set up automated responses based on keywords in comments. When followers mention specific words, trigger actions instantly.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Auto DM Sequences
              </h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Create personalized DM templates and send them automatically. Engage followers at scale without lifting a finger.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Real-Time Analytics
              </h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Track every message sent, response rate, and engagement metrics. Optimize your campaigns with actionable insights.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Three Simple Steps
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Get started in minutes. No coding required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Step 1 */}
          <div className="relative">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-indigo-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mb-6">
                1
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                Connect Instagram
              </h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Link your Instagram Business or Creator account securely via Meta's authentication. Takes 30 seconds.
              </p>
            </div>
            {/* Arrow (hidden on mobile) */}
            <div className="hidden md:block absolute top-10 -right-4 text-4xl text-gray-300 dark:text-gray-700">
              →
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-indigo-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mb-6">
                2
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                Create Automations
              </h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Set keywords, write DM templates, and choose when to send. Use pre-built templates or create custom ones.
              </p>
            </div>
            <div className="hidden md:block absolute top-10 -right-4 text-4xl text-gray-300 dark:text-gray-700">
              →
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mb-6">
              3
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              Watch Engagement Grow
            </h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Monitor real-time metrics, track conversions, and scale what works. Let automations do the heavy lifting.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section — hidden until we have real beta-user quotes (Task 10.1) */}
      {false && (
      <section className="bg-gray-50 dark:bg-gray-900 py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Loved by Creators & Businesses
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Join hundreds of content creators automating their engagement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400">
                    ⭐
                  </span>
                ))}
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                "DM Shiyam saved me hours every week. I can now engage with followers automatically while I focus on content creation. Highly recommend!"
              </p>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Sarah Chen
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Content Creator • 125K followers
                </p>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400">
                    ⭐
                  </span>
                ))}
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                "We increased our sales inquiries by 40% using DM Shiyam. The keyword triggers and analytics helped us understand what resonates with our audience."
              </p>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Rahul Patel
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  E-commerce Founder • 50K followers
                </p>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400">
                    ⭐
                  </span>
                ))}
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                "The setup was incredibly easy and the customer support is amazing. This tool is a game-changer for scaling DM engagement."
              </p>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Priya Sharma
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Digital Marketer • 85K followers
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* FAQ Section (Task 10.3) */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Everything you need to know before you start.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "How much does DM Shiyam cost?",
              a: "We offer a 14-day free trial with no credit card required. Paid plans start affordably and scale with your usage — see the pricing page for current tiers. All plans include unlimited automations; you only pay based on the volume of DMs sent.",
            },
            {
              q: "Can I cancel anytime?",
              a: "Yes. There are no long-term contracts. You can cancel your subscription from your dashboard at any time and you will retain access until the end of your current billing period. No cancellation fees, ever.",
            },
            {
              q: "Is this safe for my Instagram account?",
              a: "Yes. DM Shiyam uses Meta's official Instagram Graph API — the same infrastructure Meta approves for business messaging. We never scrape, never use unofficial endpoints, and we respect Instagram's messaging policy (24-hour window, per-user rate limits, dedup). Our app has passed Meta's official App Review.",
            },
            {
              q: "How is my data handled and protected?",
              a: "Your Instagram access token and message data are encrypted at rest and only used to power your automations. We never sell your data or share it with third parties for advertising. You can request full deletion at any time via the deletion link on your dashboard or by emailing dmshiyamofficial@gmail.com. See our Privacy Policy for the full list of sub-processors.",
            },
            {
              q: "Do I need a Facebook Page to use DM Shiyam?",
              a: "No. We use Instagram Login directly — you only need an Instagram Business or Creator account. No Facebook Page required.",
            },
          ].map((item) => (
            <details
              key={item.q}
              className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 open:shadow-sm"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-gray-900 dark:text-white text-lg">
                <span>{item.q}</span>
                <span className="ml-4 text-indigo-600 transition-transform group-open:rotate-45 text-2xl leading-none">
                  +
                </span>
              </summary>
              <p className="mt-4 text-gray-600 dark:text-gray-400 leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-800 rounded-2xl p-12 sm:p-16 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Ready to Automate Your DMs?
          </h2>
          <p className="text-lg text-indigo-100 mb-8 max-w-2xl mx-auto">
            Start your 14-day free trial today. No credit card required. Cancel anytime.
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
                  <a href="#features" className="hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white">
                    Pricing
                  </Link>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white">
                    FAQ
                  </a>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-white">
                    Blog
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <a href="/privacy" className="hover:text-white">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/terms" className="hover:text-white">
                    Terms of Service
                  </a>
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

      {/* Sticky bottom CTA (Task 10.4) */}
      {showStickyCta && !ctaDismissed && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-indigo-600 text-white shadow-lg border-t border-indigo-700 animate-in slide-in-from-bottom"
          role="region"
          aria-label="Start free trial"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <p className="text-sm sm:text-base font-medium">
              <span className="hidden sm:inline">
                Ready to automate your Instagram DMs?{" "}
              </span>
              14-day free trial. No credit card required.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/register"
                className="px-4 py-2 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors text-sm whitespace-nowrap"
              >
                Start Free Trial
              </Link>
              <button
                type="button"
                onClick={dismissCta}
                aria-label="Dismiss"
                className="p-2 text-indigo-100 hover:text-white transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}