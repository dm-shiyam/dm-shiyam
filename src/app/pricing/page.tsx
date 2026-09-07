// app/pricing/page.tsx

import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";
import PricingContent from "@/components/PricingContent";

export const metadata: Metadata = generatePageMetadata(
  "Pricing - DM Shiyam",
  "Simple, transparent pricing for Instagram automation. Free tier, Starter (₹149/mo), Pro (₹799/mo with AI), Business (₹2,499/mo) and Agency plans.",
  "/pricing",
  ["DM Shiyam pricing", "Instagram automation pricing", "affordable social media tools"]
);

export default function PricingPage() {
  return <PricingContent />;
}