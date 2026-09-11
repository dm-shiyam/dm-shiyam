// app/page.tsx — Server Component with metadata

import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";
import LandingContent from "@/components/LandingContent";

// SEO metadata — MUST match the landing H1/subline in LandingContent.tsx.
// This is what Google, WhatsApp, iMessage, Slack, Twitter, and LinkedIn
// use for link previews, so any drift here silently ships the OLD hero
// to every share/social surface even after the visible page is updated.
// (Landing hero rewritten 2026-09-10; meta caught up 2026-09-11.)
export const metadata: Metadata = generatePageMetadata(
  "DM Shiyam \u2014 Turn Instagram comments into DMs in 30 seconds",
  "Every comment on your Instagram posts triggers a personalized DM with your link, guide, or discount code. Fully automated, Meta-approved, free forever plan with 500 DMs/month.",
  "/",
  [
    "Instagram DM automation",
    "auto DM Instagram comments",
    "Instagram comment to DM",
    "Instagram automation India",
    "Meta approved DM automation",
    "Instagram marketing tool",
    "Instagram lead generation",
  ]
);

export default function HomePage() {
  return <LandingContent />;
}