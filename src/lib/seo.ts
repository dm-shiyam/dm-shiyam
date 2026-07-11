// lib/seo.ts — Centralized SEO metadata

import { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dmshiyam.com";
const siteName = "DM Shiyam";
const siteDescription =
  "Automate your Instagram DMs at scale. Send personalized messages triggered by keywords, engage followers automatically, and grow your business faster.";

export const defaultMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} - Automate Instagram DMs at Scale`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    "Instagram automation",
    "DM automation",
    "Instagram marketing",
    "social media automation",
    "Instagram growth",
    "automated messaging",
    "Instagram engagement",
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
    title: `${siteName} - Automate Instagram DMs at Scale`,
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
    title: `${siteName} - Automate Instagram DMs at Scale`,
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