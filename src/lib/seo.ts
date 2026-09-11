// lib/seo.ts — Centralized SEO metadata

import { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dmshiyam.com";
const siteName = "DM Shiyam";
// Default meta description — MUST stay in sync with the landing hero in
// LandingContent.tsx and the root <head> metadata in src/app/page.tsx.
// Any /page.tsx that does not call generatePageMetadata() falls back to
// this string as its <meta description>, so drift here silently leaks the
// old positioning to every non-metadata page (privacy, terms, register).
const siteDescription =
  "Every comment on your Instagram posts triggers a personalized DM with your link, guide, or discount code. Fully automated, Meta-approved, free forever plan with 500 DMs/month.";

export const defaultMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} \u2014 Turn Instagram comments into DMs in 30 seconds`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    "Instagram DM automation",
    "auto DM Instagram comments",
    "Instagram comment to DM",
    "Instagram automation India",
    "Meta approved DM automation",
    "Instagram marketing tool",
    "Instagram lead generation",
  ],
  authors: [{ name: "DM Shiyam" }],
  creator: "DM Shiyam",
  publisher: "DM Shiyam",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: siteName,
    title: `${siteName} \u2014 Turn Instagram comments into DMs in 30 seconds`,
    description: siteDescription,
    images: [
      {
        url: `${siteUrl}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: siteName,
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} \u2014 Turn Instagram comments into DMs in 30 seconds`,
    description: siteDescription,
    images: [`${siteUrl}/twitter-image.jpg`],
    creator: "@dmshiyam",
  },
  alternates: {
    canonical: siteUrl,
  },
};

export function generatePageMetadata(
  title: string,
  description: string,
  path: string,
  keywords?: string[]
): Metadata {
  const url = new URL(path, siteUrl).toString();

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: [
        {
          url: `${siteUrl}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${siteUrl}/twitter-image.jpg`],
    },
    alternates: {
      canonical: url,
    },
  };
}