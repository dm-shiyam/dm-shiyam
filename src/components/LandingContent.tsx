// components/LandingContent.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function LandingContent() {
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [ctaDismissed, setCtaDismissed] = useState(false);

  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("dms_sticky_cta_dismissed") === "1") {
      setCtaDismissed(true);
      return;
    }
    const onScroll = () => {
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
    <main className="min-h-screen bg-white dark:bg-gray-950 font-sans">
      {/* ─────────────────────── Nav ─────────────────────── */}
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
              href="/pricing"
              className="hidden sm:inline-flex rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Pricing
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

      {/* ─────────────────────── Hero ─────────────────────── */}
      <section className="relative overflow-hidden bg-hero-glow">
        {/* Blurred decorative blobs for warmth */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-pink-200/30 blur-3xl dark:bg-pink-900/20" />
        <div className="pointer-events-none absolute top-20 right-10 -z-10 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-900/20" />

        <div className="section py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center animate-fade-up">
            {/* Pre-headline announcement pill — carries the Meta infinity
                wordmark alongside the pulse dot so the trust signal is
                visually anchored to the brand, not just a line of text. */}
            <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-gray-200/80 bg-white/80 py-1.5 pl-3 pr-4 text-xs font-medium text-gray-700 shadow-soft backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <svg
                className="h-4 w-6"
                viewBox="0 0 36 24"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="metaGradPill" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0064E0" />
                    <stop offset="50%" stopColor="#0082FB" />
                    <stop offset="100%" stopColor="#0081FB" />
                  </linearGradient>
                </defs>
                <path
                  d="M6 18c-2.2 0-4-2.7-4-6s1.8-6 4-6c2.6 0 4.6 2.4 7.2 6.3C15.9 16.4 17.7 18 20 18c2.2 0 4-2.7 4-6s-1.8-6-4-6c-2.3 0-4.1 1.6-6.8 5.7C10.6 15.6 8.6 18 6 18z"
                  stroke="url(#metaGradPill)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-semibold text-gray-900 dark:text-white">Meta</span>
              <span className="text-gray-400">·</span>
              Tech Provider — approved on Instagram app review
            </div>

            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-gray-900 sm:text-6xl md:text-7xl dark:text-white">
              Turn Instagram comments into{" "}
              <span className="gradient-text">personal DMs</span>
              <span className="text-gray-400 dark:text-gray-600">.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl dark:text-gray-400">
              Every comment on your post triggers a personalized DM with your
              link, guide, or discount code. Fully automated, Meta-approved,{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                ₹0 to start
              </span>
              .
            </p>

            {/* CTA row */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-full bg-ig-gradient bg-[length:200%_200%] px-7 py-3.5 text-base font-semibold text-white shadow-strong transition-all hover:bg-[position:100%_0] hover:shadow-glow"
              >
                Get started free — 500 DMs/month
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-base font-medium text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                See how it works
                <span aria-hidden>↓</span>
              </Link>
            </div>

            {/* Trust row */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-gray-600 dark:text-gray-400">
              <TrustCheck>Meta approved</TrustCheck>
              <TrustCheck>No credit card</TrustCheck>
              <TrustCheck>Free forever — 500 DMs/mo</TrustCheck>
              <TrustCheck>Cancel anytime</TrustCheck>
            </div>
          </div>

          {/* Hero visual — stylised dashboard preview card.
              Browser chrome + inline product mock. Keeps the hero section
              from feeling empty while we don't yet have a real screenshot
              asset ready. */}
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div className="pointer-events-none absolute inset-x-0 -top-6 -z-10 mx-auto h-72 w-3/4 rounded-full bg-ig-gradient opacity-20 blur-3xl" />
            <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-strong dark:border-gray-800 dark:bg-gray-900">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/50">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-xs text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                  dmshiyam.com/dashboard
                </div>
              </div>
              {/* Real dashboard screenshot — see public/screenshots/
                  README. Falls back to a mock below when the file isn't
                  present yet (keeps SSR + Vercel deploys green). */}
              <HeroScreenshot />
            </div>
          </div>
        </div>

        {/* Social-proof strip */}
        <div className="border-t border-gray-100 bg-white/60 py-10 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/60">
          <div className="section">
            <p className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Trusted by Indian creators & brands going viral
            </p>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <SocialProof number="100%" label="Meta-safe" />
              <SocialProof number="&lt; 1s" label="Avg DM latency" />
              <SocialProof number="4.9★" label="Beta rating" />
              <SocialProof number="0" label="Accounts banned" />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────── Features ─────────────────────── */}
      <section id="features" className="section py-24 sm:py-32">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-pink-100 bg-pink-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-pink-700 dark:border-pink-900/40 dark:bg-pink-950/40">
            Features
          </div>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Everything a creator needs to{" "}
            <span className="gradient-text">capture leads at scale</span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Built around the way creators actually post. No ManyChat flowcharts,
            no "campaign builders" — just comment → DM, in 30 seconds.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon="🎯"
            title="Keyword triggers"
            description="Comments matching your trigger word fire an instant DM. Multiple keywords, per-automation routing, works across all your Reels at once."
            accent="pink"
          />
          <FeatureCard
            icon="🤖"
            title="AI Smart Replies"
            description="On Pro+, GPT writes a personal reply using the commenter's context — the comment text, their handle, your product. Reads like you wrote it."
            accent="violet"
          />
          <FeatureCard
            icon="📈"
            title="Real-time analytics"
            description="See every DM sent, every reply received, which Reels drive the most leads. Export to CSV on Business+. All in one simple dashboard."
            accent="amber"
          />
          <FeatureCard
            icon="🔒"
            title="100% Meta-safe"
            description="Official Instagram Business API — not a browser bot, not scraping. Approved by Meta's app review. Zero bans across the full beta."
            accent="emerald"
          />
          <FeatureCard
            icon="⚡"
            title="30-second setup"
            description="Sign in with Instagram, pick a keyword, write a DM. Live in under a minute — no Facebook Page required, no Zapier, no code."
            accent="sky"
          />
          <FeatureCard
            icon="🇮🇳"
            title="Built for India"
            description="UPI, Indian cards, GST invoices, Razorpay-secured billing. Pricing from ₹149/mo — not ₹149 → $49 → ₹4,000 conversion tricks."
            accent="rose"
          />
        </div>
      </section>

      {/* ─────────────────────── How it works ─────────────────────── */}
      <section
        id="how-it-works"
        className="relative overflow-hidden bg-gray-50 py-24 sm:py-32 dark:bg-gray-900"
      >
        <div className="section">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40">
              How it works
            </div>
            <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
              Live in <span className="gradient-text">three steps</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Most creators are capturing leads within 2 minutes of signing up.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Step
              n={1}
              title="Connect Instagram"
              body="Sign in with Instagram's official Business Login (30 seconds, no password shared). Supports Business + Creator accounts."
            />
            <Step
              n={2}
              title="Create your automation"
              body="Pick a trigger word (e.g. GUIDE), paste your DM template with a link. Save. That's it."
            />
            <Step
              n={3}
              title="Post the Reel & watch DMs fly"
              body="Caption: 'Comment GUIDE for the free playbook.' Every commenter gets your DM in under a second, forever."
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────── See it in action ─────────────────────── */}
      {/* Real-world proof section. 3 screenshots walk through the full
          comment → DM → conversation flow on actual Instagram. This is
          the highest-trust element on the page: skeptics evaluating "is
          this real or a scam?" convert here, not on claim-style copy. */}
      <section id="proof" className="section py-24 sm:py-32">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40">
            See it in action
          </div>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Real conversations,{" "}
            <span className="gradient-text">on real Instagram accounts</span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Not a demo video, not a mockup. Here's a live automation
            captured end-to-end from one of our beta creators.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <ProofStep
            n={1}
            title="A follower comments the keyword"
            caption="They see your Reel's CTA — 'comment GUIDE' — and drop the word in."
            src="/screenshots/01-comment.png"
            fallbackMock="comment"
          />
          <ProofStep
            n={2}
            title="DM Shiyam auto-sends the DM"
            caption="Within one second, Instagram delivers your personalized DM. No bots, no browser hacks — Meta's official API."
            src="/screenshots/02-dm.png"
            fallbackMock="dm"
          />
          <ProofStep
            n={3}
            title="They reply, you convert"
            caption="Now it's a real conversation. Pro users let AI handle the follow-up; Business users bulk-reply from one dashboard."
            src="/screenshots/03-reply.png"
            fallbackMock="reply"
          />
        </div>
      </section>

      {/* ─────────────────────── FAQ ─────────────────────── */}
      <section id="faq" className="section py-24 sm:py-32">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Questions, <span className="gradient-text">straight answers</span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Everything you need to know before you start.
          </p>
        </div>

        <div className="mx-auto max-w-3xl space-y-3">
          {[
            {
              q: "How much does DM Shiyam cost?",
              a: "Free forever with 500 DMs/month — no credit card, no time limit. Paid plans start at ₹149/mo (Starter, 5,000 DMs) and scale to Pro (₹799/mo, 25,000 DMs + AI Smart Replies), Business (₹2,499/mo, 100,000 DMs + CSV export), and Agency (custom). See the pricing page for the full breakdown.",
            },
            {
              q: "Can I cancel anytime?",
              a: "Yes — one click in your dashboard. Your plan stays active until the end of your current billing cycle; you won't be charged again. No cancellation fees, no lock-in.",
            },
            {
              q: "Is this safe for my Instagram account?",
              a: "100% safe. DM Shiyam uses Instagram's official partner system, approved by Meta. We never log into your account and we stay well within Instagram's daily messaging limits. Our app passed Meta's full app review. Zero accounts banned across the entire beta.",
            },
            {
              q: "How is my data handled and protected?",
              a: "Your Instagram connection and message data are encrypted at rest and only used to send your automated DMs. We never sell your data or share it with advertisers. You can delete everything anytime from your dashboard — or email dmshiyamofficial@gmail.com. Full details in our Privacy Policy.",
            },
            {
              q: "Do I need a Facebook Page to use DM Shiyam?",
              a: "No. You only need an Instagram Business or Creator account. Connect directly with Instagram Login — no Facebook Page required.",
            },
          ].map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all open:shadow-medium dark:border-gray-800 dark:bg-gray-900"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-semibold text-gray-900 dark:text-white">
                <span className="text-base sm:text-lg">{item.q}</span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-all group-open:rotate-45 group-open:bg-ig-gradient group-open:text-white dark:bg-gray-800 dark:text-gray-300">
                  +
                </span>
              </summary>
              <p className="mt-4 leading-relaxed text-gray-600 dark:text-gray-400">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ─────────────────────── Final CTA ─────────────────────── */}
      <section className="section pb-24 pt-10 sm:pb-32">
        <div className="relative overflow-hidden rounded-3xl bg-gray-900 p-10 text-center shadow-strong sm:p-16">
          {/* Instagram gradient overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-80 bg-ig-gradient"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-grid-light bg-grid-20 opacity-20"
            aria-hidden
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Your next Reel could be your biggest lead magnet.
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

      {/* ─────────────────────── Footer ─────────────────────── */}
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
            <FooterCol
              title="Product"
              links={[
                { href: "#features", label: "Features" },
                { href: "/pricing", label: "Pricing" },
                { href: "/blog", label: "Blog" },
                { href: "#faq", label: "FAQ" },
              ]}
            />
            <FooterCol
              title="Company"
              links={[
                { href: "/privacy", label: "Privacy Policy" },
                { href: "/terms", label: "Terms of Service" },
                {
                  href: "mailto:dmshiyamofficial@gmail.com",
                  label: "Contact",
                },
              ]}
            />
          </div>
          <div className="border-t border-gray-100 pt-6 text-center text-sm text-gray-400 dark:border-gray-800">
            © {new Date().getFullYear()} DM Shiyam. All rights reserved.
          </div>
        </div>
      </footer>

      {/* ─────────────────────── Sticky CTA ─────────────────────── */}
      {showStickyCta && !ctaDismissed && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-gray-900/95 text-white shadow-strong backdrop-blur-xl animate-in slide-in-from-bottom"
          role="region"
          aria-label="Start free — 500 DMs per month"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-30 bg-ig-gradient"
            aria-hidden
          />
          <div className="section relative flex items-center justify-between gap-4 py-3">
            <p className="text-sm font-medium sm:text-base">
              <span className="hidden sm:inline">
                Ready to automate your Instagram DMs?{" "}
              </span>
              Free forever — 500 DMs/mo, no credit card.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/register"
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-all hover:scale-[1.03]"
              >
                Get started free →
              </Link>
              <button
                type="button"
                onClick={dismissCta}
                aria-label="Dismiss"
                className="p-2 text-white/70 transition-colors hover:text-white"
              >
                <svg
                  className="h-5 w-5"
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
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─────────────────────── Sub-components ───────────────────────

// Hero dashboard screenshot. Uses /screenshots/hero-dashboard.png when
// available; otherwise falls back to the inline mock so the page still
// renders if Ankit hasn't dropped the file yet. The fallback is a
// client-side swap on <img> error to avoid breaking SSR.
function HeroScreenshot() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="grid gap-6 p-8 md:grid-cols-5">
        <div className="md:col-span-2">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400">
            This month
          </div>
          <div className="mb-4 text-5xl font-bold text-gray-900 dark:text-white">
            1,284
          </div>
          <div className="mb-6 text-sm text-gray-500">
            DMs sent automatically{" "}
            <span className="font-medium text-emerald-600">
              +42% from last month
            </span>
          </div>
          <div className="space-y-2">
            <MockRow name="guide" count={463} color="pink" />
            <MockRow name="price" count={281} color="violet" />
            <MockRow name="link" count={192} color="amber" />
          </div>
        </div>
        <div className="rounded-xl bg-ig-gradient-soft p-5 md:col-span-3">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-pink-700 backdrop-blur">
            New DM sent
          </div>
          <div className="mb-2 text-sm text-gray-700">
            @priyacreator commented{" "}
            <span className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs text-pink-700">
              guide
            </span>{" "}
            on your Reel
          </div>
          <div className="rounded-xl bg-white p-4 shadow-soft">
            <div className="mb-1 text-xs font-medium text-gray-400">
              DM auto-sent · 0.4s later
            </div>
            <div className="text-sm leading-relaxed text-gray-800">
              Hey @priyacreator 👋 Here's the free guide I promised —
              <span className="font-medium text-pink-700"> dmshiyam.com/guide</span>
              . Reply if you have questions!
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- intentional
    // native <img> so a missing file falls back via onError instead of
    // the Next.js image optimizer throwing a server error.
    <img
      src="/screenshots/hero-dashboard.png"
      alt="DM Shiyam dashboard"
      className="w-full"
      onError={() => setFailed(true)}
    />
  );
}

// Proof-section step. Phone-frame styled card: image on top, numbered
// chip + caption below. Shows a tasteful placeholder with the mocked
// content when the real screenshot isn't yet in /public/screenshots/.
function ProofStep({
  n,
  title,
  caption,
  src,
  fallbackMock,
}: {
  n: number;
  title: string;
  caption: string;
  src: string;
  fallbackMock: "comment" | "dm" | "reply";
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-soft transition-all hover:-translate-y-1 hover:shadow-strong dark:border-gray-800 dark:bg-gray-900">
      {/* Soft gradient top strip for brand continuity */}
      <div className="h-1 w-full bg-ig-gradient" aria-hidden />
      {/* Image area — fixed aspect ratio so the row stays even whether
          the real screenshot is a square, 9:19.5 phone shot, or landscape. */}
      <div className="relative aspect-[9/16] max-h-[520px] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
        {failed ? (
          <ProofPlaceholder kind={fallbackMock} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={title}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {/* Caption */}
      <div className="p-6">
        <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ig-gradient text-xs font-bold text-white shadow-glow">
          {n}
        </div>
        <h3 className="mb-1.5 text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {caption}
        </p>
      </div>
    </div>
  );
}

// Placeholder that renders when the real screenshot isn't present yet.
// Not a "broken image" — a styled mock that reads as intentional so
// the page always looks shipped, and Ankit can drop screenshots in
// at his pace without a visual regression window.
function ProofPlaceholder({ kind }: { kind: "comment" | "dm" | "reply" }) {
  const content = {
    comment: {
      header: "Instagram · Reel",
      body: (
        <>
          <div className="mb-2 text-sm font-semibold text-gray-800">
            @priyacreator
          </div>
          <div className="rounded-xl bg-gray-100 p-3 text-sm text-gray-800">
            <span className="font-mono rounded bg-pink-100 px-1.5 py-0.5 text-pink-700">
              guide
            </span>{" "}
            👀
          </div>
          <div className="mt-2 text-xs text-gray-400">just now · reply</div>
        </>
      ),
    },
    dm: {
      header: "Instagram · Direct",
      body: (
        <>
          <div className="mb-3 text-xs text-gray-400">0.4s later</div>
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-gradient-to-br from-pink-500 to-rose-500 p-3 text-sm text-white shadow-glow">
            Hey @priyacreator 👋 Here's the free guide I promised —
            <br />
            <span className="underline">dmshiyam.com/guide</span>
          </div>
        </>
      ),
    },
    reply: {
      header: "Instagram · Direct",
      body: (
        <>
          <div className="mb-3 max-w-[85%] rounded-2xl rounded-tl-sm bg-gradient-to-br from-pink-500 to-rose-500 p-3 text-sm text-white">
            Here's the free guide — dmshiyam.com/guide
          </div>
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-gray-100 p-3 text-sm text-gray-800">
            This is exactly what I needed, thank you! Do you have one on
            pricing too?
          </div>
          <div className="mt-2 text-xs text-emerald-600">● priyacreator is typing…</div>
        </>
      ),
    },
  }[kind];

  return (
    <div className="flex h-full flex-col p-5">
      <div className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {content.header}
      </div>
      <div className="flex-1 space-y-2">{content.body}</div>
      <div className="mt-4 text-center text-[10px] uppercase tracking-wider text-gray-400">
        · placeholder · drop /screenshots/{kind === "comment" ? "01-comment" : kind === "dm" ? "02-dm" : "03-reply"}.png ·
      </div>
    </div>
  );
}

function TrustCheck({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <svg
        className="h-4 w-4 text-emerald-500"
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
      <span className="text-gray-700 dark:text-gray-300">{children}</span>
    </span>
  );
}

function MockRow({
  name,
  count,
  color,
}: {
  name: string;
  count: number;
  color: "pink" | "violet" | "amber";
}) {
  const palette = {
    pink: "bg-pink-100 text-pink-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-700",
  }[color];
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${palette}`}
        >
          {name}
        </span>
        <span className="text-gray-500">keyword</span>
      </div>
      <div className="font-semibold text-gray-900">
        {count.toLocaleString()}
      </div>
    </div>
  );
}

function SocialProof({ number, label }: { number: string; label: string }) {
  return (
    <div className="text-center">
      <div
        className="gradient-text text-3xl font-bold tracking-tight sm:text-4xl"
        dangerouslySetInnerHTML={{ __html: number }}
      />
      <div className="mt-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  accent,
}: {
  icon: string;
  title: string;
  description: string;
  accent: "pink" | "violet" | "amber" | "emerald" | "sky" | "rose";
}) {
  const accentMap: Record<string, string> = {
    pink: "from-pink-100 to-pink-50",
    violet: "from-violet-100 to-violet-50",
    amber: "from-amber-100 to-amber-50",
    emerald: "from-emerald-100 to-emerald-50",
    sky: "from-sky-100 to-sky-50",
    rose: "from-rose-100 to-rose-50",
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-7 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-medium dark:border-gray-800 dark:bg-gray-900">
      <div
        className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accentMap[accent]} text-2xl`}
      >
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="relative">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ig-gradient text-xl font-bold text-white shadow-strong">
        {n}
      </div>
      <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="leading-relaxed text-gray-600 dark:text-gray-400">
        {body}
      </p>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
        {title}
      </h4>
      <ul className="space-y-2.5 text-sm text-gray-500 dark:text-gray-400">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="transition-colors hover:text-gray-900 dark:hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
