import Link from "next/link";
import {
  MessageCircle,
  Zap,
  BarChart3,
  Shield,
  ArrowRight,
  Instagram,
  Send,
  Target,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen" suppressHydrationWarning>
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600">
              <Send className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold">DM Shiyam</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Pricing</Link>
            <Link href="/login" className="btn-primary !py-2 !px-4 text-sm">
              Sign In
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-100 via-pink-50 to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-sm text-purple-700">
            <Zap className="h-3.5 w-3.5" />
            Powered by Official Instagram Graph API
          </div>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Turn Comments Into
            <br />
            <span className="gradient-text">Conversations & Sales</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-600">
            When someone comments a keyword on your post, DM Shiyam
            automatically sends them a personalized DM. Capture leads, share
            resources, and grow your business on autopilot.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/login" className="btn-primary text-base">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a href="#how-it-works" className="btn-secondary text-base">
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-4 text-center text-3xl font-bold">
            How It Works
          </h2>
          <p className="mb-16 text-center text-gray-500">
            Set up in 3 simple steps. Start converting in minutes.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                icon: Target,
                title: "Set Your Keywords",
                desc: 'Choose trigger words like "INFO", "LINK", or "PRICE" that activate the bot when someone comments them.',
              },
              {
                step: "2",
                icon: MessageCircle,
                title: "Craft Your DM",
                desc: "Write the perfect message with personalization. Include links, offers, or resources you want to share.",
              },
              {
                step: "3",
                icon: Send,
                title: "Auto-Send DMs",
                desc: "When someone comments your keyword, they instantly receive your DM. No manual work needed.",
              },
            ].map((item) => (
              <div key={item.step} className="card text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-lg font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-16 text-center text-3xl font-bold">
            Everything You Need
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                icon: Instagram,
                title: "Official API",
                desc: "Built on Meta's official Instagram Graph API. No risk of account bans.",
                color: "from-pink-500 to-rose-500",
              },
              {
                icon: Zap,
                title: "Instant Delivery",
                desc: "DMs are sent within seconds of detecting a matching comment.",
                color: "from-amber-500 to-orange-500",
              },
              {
                icon: BarChart3,
                title: "Analytics Dashboard",
                desc: "Track DMs sent, keywords performance, and conversion rates.",
                color: "from-blue-500 to-indigo-500",
              },
              {
                icon: Shield,
                title: "Smart Matching",
                desc: "Word-boundary matching ensures accuracy. No false triggers.",
                color: "from-emerald-500 to-teal-500",
              },
            ].map((feature) => (
              <div key={feature.title} className="card flex gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color}`}
                >
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">{feature.title}</h3>
                  <p className="text-sm text-gray-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="card bg-gradient-to-br from-purple-600 to-pink-500 text-white">
            <h2 className="mb-4 text-3xl font-bold">
              Ready to Automate Your DMs?
            </h2>
            <p className="mb-8 text-purple-100">
              Start capturing leads from your Instagram comments today.
              Free to set up.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3 font-semibold text-purple-700 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
            >
              Open Dashboard
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-gray-400">
          DM Shiyam — Built with Next.js & Instagram Graph API
        </div>
      </footer>
    </div>
  );
}
