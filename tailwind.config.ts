import type { Config } from "tailwindcss";

// Design system — DM Shiyam "bold creator-brand" direction (2026-10-02).
// Instagram-inspired warm gradient (sunset: amber → pink → fuchsia → violet)
// as the hero accent; neutral slate for surfaces; soft layered shadows for
// premium depth without going dark/corporate. All tokens exposed as
// Tailwind utilities so we can keep JSX legible instead of inlining hex
// everywhere.
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Hot-pink brand ramp. Kept the original name so existing components
        // using text-brand-500 etc. don't break.
        brand: {
          50: "#fdf2f8",
          100: "#fce7f3",
          200: "#fbcfe8",
          300: "#f9a8d4",
          400: "#f472b6",
          500: "#ec4899",
          600: "#db2777",
          700: "#be185d",
          800: "#9d174d",
          900: "#831843",
        },
        // Sunset accents used across hero gradients + CTA buttons.
        sunset: {
          50:  "#fff8f0",
          100: "#ffecd1",
          200: "#ffd59a",
          300: "#ffb45b",
          400: "#fb8c3a",
          500: "#f0613c",
          600: "#dc2743",
          700: "#bc1888",
          800: "#833ab4",
        },
      },
      backgroundImage: {
        // Signature mark — used in nav logo, feature icon tiles, hero CTA.
        // 45° so it reads top-left-to-bottom-right (same orientation IG uses).
        "ig-gradient":
          "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
        "ig-gradient-soft":
          "linear-gradient(135deg, #fff8f0 0%, #ffecd1 20%, #fce7f3 60%, #faf5ff 100%)",
        // Hero backdrop — radial sunset glow fading to white; subtle enough
        // not to steal attention from the headline, but gives the page
        // temperature without stock-photo clichés.
        "hero-glow":
          "radial-gradient(1200px 600px at 50% -10%, rgba(236,72,153,0.18), transparent 50%), radial-gradient(900px 500px at 80% 20%, rgba(251,146,60,0.14), transparent 60%), radial-gradient(900px 500px at 15% 10%, rgba(168,85,247,0.12), transparent 60%)",
        // Grid texture, used sparingly as a backdrop on dark CTA blocks.
        "grid-light":
          "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-20": "20px 20px",
      },
      boxShadow: {
        // Three-tier elevation. Soft (default cards), medium (interactive
        // elements), strong (hero focal elements, modals).
        soft: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        medium: "0 4px 12px rgba(16,24,40,0.06), 0 2px 4px rgba(16,24,40,0.04)",
        strong: "0 20px 40px -12px rgba(236,72,153,0.25), 0 10px 20px -10px rgba(168,85,247,0.15)",
        glow: "0 0 0 1px rgba(236,72,153,0.1), 0 10px 30px -10px rgba(236,72,153,0.3)",
      },
      animation: {
        "fade-up": "fade-up 600ms cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 2.5s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
