// src/app/og/blog/[slug]/route.tsx
// Dynamic OG image generator for blog posts — 1200x630 PNG rendered by Vercel/Next.
import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/blog";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const post = getPostBySlug(slug);

  const title = post?.title ?? "DM Shiyam Blog";
  const description =
    post?.description ??
    "Guides and playbooks for Instagram DM automation.";
  const readingTime = post?.readingTime ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundImage:
            "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: brand + badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                background: "white",
                color: "#4f46e5",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 800,
              }}
            >
              D
            </div>
            <span>DM Shiyam</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 20,
              padding: "10px 18px",
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            <span>✓</span>
            <span>Meta Approved</span>
          </div>
        </div>

        {/* Middle: title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            maxWidth: "1000px",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            Blog · Instagram DM Automation
          </div>
          <div
            style={{
              fontSize: title.length > 60 ? 60 : 72,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 26,
              opacity: 0.9,
              lineHeight: 1.4,
              maxWidth: "900px",
            }}
          >
            {description.length > 140
              ? description.slice(0, 137) + "…"
              : description}
          </div>
        </div>

        {/* Bottom: reading time + url */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            opacity: 0.9,
          }}
        >
          <span>{readingTime}</span>
          <span>dmshiyam.com/blog</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
