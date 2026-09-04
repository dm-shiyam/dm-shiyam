// src/lib/blog.ts — Reads markdown posts from src/content/blog

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

const BLOG_DIR = path.join(process.cwd(), "src", "content", "blog");

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO
  readingTime: string;
  keywords?: string[];
  ogImage?: string;
  author?: string;
};

export type Post = PostMeta & {
  html: string;
};

function estimateReadingTime(markdown: string): string {
  const words = markdown.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return `${minutes} min read`;
}

export function getAllPostMeta(): PostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
  const posts = files.map((filename) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf8");
    const { data, content } = matter(raw);
    const slug = filename.replace(/\.md$/, "");
    return {
      slug,
      title: data.title ?? slug,
      description: data.description ?? "",
      date: data.date ?? new Date().toISOString(),
      readingTime: estimateReadingTime(content),
      keywords: data.keywords ?? [],
      ogImage: data.ogImage,
      author: data.author ?? "DM Shiyam Team",
    } satisfies PostMeta;
  });
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const html = marked.parse(content, { async: false }) as string;
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? new Date().toISOString(),
    readingTime: estimateReadingTime(content),
    keywords: data.keywords ?? [],
    ogImage: data.ogImage,
    author: data.author ?? "DM Shiyam Team",
    html,
  };
}

export function getAllSlugs(): string[] {
  return getAllPostMeta().map((p) => p.slug);
}
