import type { PlanConfig, PlanType } from "@/types";

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    name: "Free",
    price_monthly: 0,
    price_label: "₹0",
    dm_limit: 500,
    max_automations: 2,
    max_accounts: 1,
    ai_enabled: false,
    analytics: false,
    features: [
      "500 DMs/month",
      "2 automations",
      "1 Instagram account",
      "Basic templates",
      "Community support",
    ],
  },
  starter: {
    name: "Starter",
    price_monthly: 14900, // ₹149 in paise
    price_label: "₹149",
    dm_limit: 5000,
    max_automations: 10,
    max_accounts: 1,
    ai_enabled: false,
    analytics: true,
    features: [
      "5,000 DMs/month",
      "10 automations",
      "1 Instagram account",
      "Analytics dashboard",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    price_monthly: 79900, // ₹799 in paise
    price_label: "₹799",
    dm_limit: 25000,
    max_automations: -1, // unlimited
    max_accounts: 3,
    ai_enabled: true,
    analytics: true,
    features: [
      "25,000 DMs/month",
      "Unlimited automations",
      "3 Instagram accounts",
      "AI Smart Replies",
      "Full analytics",
      "Priority support",
    ],
  },
  business: {
    name: "Business",
    price_monthly: 249900, // ₹2,499 in paise
    price_label: "₹2,499",
    dm_limit: 100000,
    max_automations: -1,
    max_accounts: 10,
    ai_enabled: true,
    analytics: true,
    features: [
      "100,000 DMs/month",
      "Unlimited automations",
      "10 Instagram accounts",
      "AI Smart Replies",
      "Full analytics",
      "API access",
      "Dedicated support",
    ],
  },
  agency: {
    name: "Agency",
    price_monthly: 599900, // ₹5,999 in paise
    price_label: "₹5,999",
    dm_limit: -1, // unlimited
    max_automations: -1,
    max_accounts: -1, // unlimited
    ai_enabled: true,
    analytics: true,
    features: [
      "Unlimited DMs",
      "Unlimited automations",
      "Unlimited accounts",
      "AI Smart Replies",
      "Full analytics",
      "White-label option",
      "Dedicated account manager",
    ],
  },
};
