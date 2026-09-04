// src/app/blog/page.tsx — Blog index

import Link from "next/link";
import type { Metadata } from "next";
import { getAllPostMeta } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — DM Shiyam",
  description:
    "Guides, comparisons, and playbooks for automating Instagram DMs, growing engagement, and turning comments into leads.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  const posts = getAllPostMeta();

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            DM Shiyam
          </Link>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <header className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Blog
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Playbooks and guides for creators and small businesses automating
            Instagram engagement.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">
            No posts yet. Check back soon.
          </p>
        ) : (
          <ul className="space-y-8">
            {posts.map((post) => (
              <li
                key={post.slug}
                className="border-b border-gray-200 dark:border-gray-800 pb-8 last:border-0"
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block"
                >
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-2">
                    <time dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                    <span>·</span>
                    <span>{post.readingTime}</span>
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2">
                    {post.title}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {post.description}
                  </p>
                  <span className="inline-block mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 group-hover:underline">
                    Read more →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
