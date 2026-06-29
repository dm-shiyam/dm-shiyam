"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Send,
  ArrowLeft,
  Check,
  Sparkles,
  Zap,
  Crown,
  Building2,
  Users,
} from "lucide-react";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "forever",
    icon: Zap,
    color: "from-gray-400 to-gray-500",
    features: [
      "100 DMs/month",
      "2 automations",
      "1 Instagram account",
      "Basic templates",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "₹499",
    period: "/month",
    icon: Sparkles,
    color: "from-blue-500 to-cyan-500",
    features: [
      "1,000 DMs/month",
      "5 automations",
      "1 Instagram account",
      "Analytics dashboard",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹1,999",
    period: "/month",
    icon: Crown,
    color: "from-purple-500 to-pink-500",
    features: [
      "5,000 DMs/month",
      "Unlimited automations",
      "3 Instagram accounts",
      "AI Smart Replies",
      "Full analytics",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    price: "₹4,999",
    period: "/month",
    icon: Building2,
    color: "from-amber-500 to-orange-500",
    features: [
      "20,000 DMs/month",
      "Unlimited automations",
      "10 Instagram accounts",
      "AI Smart Replies",
      "Full analytics",
      "API access",
      "Dedicated support",
    ],
    cta: "Go Business",
    popular: false,
  },
  {
    id: "agency",
    name: "Agency",
    price: "₹9,999",
    period: "/month",
    icon: Users,
    color: "from-emerald-500 to-teal-500",
    features: [
      "Unlimited DMs",
      "Unlimited automations",
      "Unlimited accounts",
      "AI Smart Replies",
      "Full analytics",
      "White-label option",
      "Dedicated account manager",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    if (!session) {
      router.push("/login?callbackUrl=/pricing");
      return;
    }

    if (planId === "free") {
      router.push("/dashboard");
      return;
    }

    setLoadingPlan(planId);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      const data = await res.json();

      if (data.subscription_id) {
        const options = {
          key: data.razorpay_key,
          subscription_id: data.subscription_id,
          name: "DM Shiyam",
          description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
          handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
            await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                payment_id: response.razorpay_payment_id,
                subscription_id: response.razorpay_subscription_id,
                signature: response.razorpay_signature,
                plan: planId,
              }),
            });
            router.push("/dashboard?upgraded=true");
          },
          prefill: {
            email: session.user?.email,
            name: session.user?.name,
          },
          theme: {
            color: "#8B5CF6",
          },
        };

        const razorpay = new (window as unknown as Record<string, unknown> & { Razorpay: new (opts: unknown) => { open: () => void } }).Razorpay(options);
        razorpay.open();
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-purple-600">
                <Send className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold">DM Shiyam</span>
            </div>
          </div>
          {session ? (
            <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
          ) : (
            <Link href="/login" className="btn-primary !py-2">Sign In</Link>
          )}
        </div>
      </header>

      <main className="mx-auto px-6 py-16" style={{ maxWidth: 960 }}>
        <div className="text-center" style={{ marginBottom: 48 }}>
          <h1 className="text-4xl font-bold text-gray-900" style={{ marginBottom: 12 }}>
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-gray-500 mx-auto" style={{ maxWidth: 480 }}>
            Start free, upgrade when you&apos;re ready. Every plan includes a 7-day free trial.
          </p>
        </div>

        {/* Top 3 plans */}
        <div className="grid gap-6 md:grid-cols-3" style={{ marginBottom: 24 }}>
          {plans.slice(0, 3).map((plan) => (
            <div
              key={plan.id}
              className="relative flex flex-col rounded-2xl bg-white transition-all hover:shadow-lg"
              style={{
                border: plan.popular ? "2px solid #a78bfa" : "1px solid #d1d5db",
                padding: 28,
                boxShadow: plan.popular
                  ? "0 4px 24px rgba(139, 92, 246, 0.15)"
                  : "0 2px 12px rgba(0,0,0,0.04)",
              }}
            >
              {plan.popular && (
                <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ top: -14 }}>
                  <span
                    className="whitespace-nowrap text-white font-bold uppercase"
                    style={{
                      background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                      borderRadius: 20,
                      padding: "6px 18px",
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                    }}
                  >
                    Most Popular
                  </span>
                </div>
              )}

              <div
                className={`flex items-center justify-center rounded-xl bg-gradient-to-br ${plan.color}`}
                style={{ width: 44, height: 44, marginBottom: 20 }}
              >
                <plan.icon className="h-5 w-5 text-white" />
              </div>

              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
              <div className="flex items-baseline gap-1" style={{ marginTop: 4, marginBottom: 20 }}>
                <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                <span className="text-sm text-gray-400 font-medium">{plan.period}</span>
              </div>

              <ul className="flex-1" style={{ marginBottom: 28 }}>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm text-gray-600" style={{ marginBottom: 10 }}>
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loadingPlan === plan.id}
                className="w-full text-sm font-semibold transition-all active:scale-[0.98]"
                style={{
                  borderRadius: 12,
                  padding: "12px 16px",
                  ...(plan.popular
                    ? {
                        background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                        color: "#fff",
                        border: "none",
                        boxShadow: "0 4px 16px rgba(139, 92, 246, 0.25)",
                      }
                    : {
                        background: "#fff",
                        color: "#374151",
                        border: "1.5px solid #d1d5db",
                      }),
                }}
              >
                {loadingPlan === plan.id ? "Processing..." : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Bottom 2 plans */}
        <div className="grid gap-6 md:grid-cols-2">
          {plans.slice(3).map((plan) => (
            <div
              key={plan.id}
              className="relative flex flex-col rounded-2xl bg-white transition-all hover:shadow-lg"
              style={{
                border: "1px solid #d1d5db",
                padding: 28,
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}
            >
              <div
                className={`flex items-center justify-center rounded-xl bg-gradient-to-br ${plan.color}`}
                style={{ width: 44, height: 44, marginBottom: 20 }}
              >
                <plan.icon className="h-5 w-5 text-white" />
              </div>

              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
              <div className="flex items-baseline gap-1" style={{ marginTop: 4, marginBottom: 20 }}>
                <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                <span className="text-sm text-gray-400 font-medium">{plan.period}</span>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-x-4" style={{ marginBottom: 28 }}>
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5 text-sm text-gray-600" style={{ marginBottom: 10 }}>
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loadingPlan === plan.id}
                className="w-full text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]"
                style={{ borderRadius: 12, padding: "12px 16px", border: "1.5px solid #d1d5db", background: "#fff" }}
              >
                {loadingPlan === plan.id ? "Processing..." : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center" style={{ marginTop: 48 }}>
          <p className="text-sm text-gray-400">
            All plans include a 7-day free trial. Cancel anytime. Prices in INR. GST extra where applicable.
          </p>
        </div>
      </main>

      {/* Razorpay script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />
    </div>
  );
}
