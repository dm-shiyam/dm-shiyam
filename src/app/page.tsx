// app/page.tsx — Server Component with metadata

import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";
import LandingContent from "@/components/LandingContent";

export const metadata: Metadata = generatePageMetadata(
  "DM Shiyam - Automate Instagram DMs at Scale",
  "Connect with your Instagram followers instantly. Send personalized DMs triggered by keywords, automate responses, and grow your business without the manual work.",
  "/",
  [
    "Instagram automation",
    "DM automation",
    "Instagram marketing",
    "social media automation",
    "Instagram growth",
  ]
);

export default function HomePage() {
  return <LandingContent />;
}