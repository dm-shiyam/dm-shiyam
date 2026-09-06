// src/app/docs/api/page.tsx
// V8.2 — Public API reference page.
// Renders `docs/API.md` as a styled HTML page instead of shipping a separate
// GitHub Pages site. Content is compiled at build time (no runtime IO).

import fs from "fs";
import path from "path";
import { marked } from "marked";
import Link from "next/link";
import { generatePageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = generatePageMetadata(
  "API Reference | DM Shiyam",
  "Full REST API reference for DM Shiyam. Authentication, automations, webhooks, billing, and admin endpoints.",
  "/docs/api",
  ["api", "reference", "docs", "instagram automation api"],
);

// Rebuild at most every hour if anyone changes docs/API.md between deploys.
export const revalidate = 3600;

function getApiHtml(): string {
  const md = fs.readFileSync(
    path.join(process.cwd(), "docs", "API.md"),
    "utf8",
  );
  return marked.parse(md) as string;
}

export default function ApiDocsPage() {
  const html = getApiHtml();

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="sticky top-0 z-40 bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            DM Shiyam
          </Link>
          <div className="flex gap-4 text-sm">
            <Link href="/pricing" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600">
              Pricing
            </Link>
            <Link href="/blog" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600">
              Blog
            </Link>
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Login
            </Link>
          </div>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div
          className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-100 prose-code:dark:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-a:text-indigo-600 dark:prose-a:text-indigo-400"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>

      <footer className="border-t border-gray-200 dark:border-gray-800 py-8 mt-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Need help?{" "}
          <a
            href="mailto:dmshiyamofficial@gmail.com"
            className="text-indigo-600 hover:text-indigo-700"
          >
            dmshiyamofficial@gmail.com
          </a>
        </div>
      </footer>
    </main>
  );
}
