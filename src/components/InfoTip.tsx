"use client";

// A9.2 — Tiny hover/focus tooltip used to explain fields and CTAs where users
// were dropping off in the onboarding funnel. Keeps the DOM cheap (no portal,
// no popper) — a plain absolutely-positioned bubble is plenty for one-liners.
//
// Usage:
//   <InfoTip text="Comma-separated list, e.g. INFO, LINK, GUIDE" />
//   <InfoTip>Connect an Instagram <b>Business</b> or <b>Creator</b> account.</InfoTip>
//
// The trigger is keyboard-focusable and exposes the same content via `title=`
// as a fallback for touch devices where hover doesn't exist.

import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  /** Plain text form used for `title=` fallback and aria-label. */
  text?: string;
  /** Rich content form (overrides text visually but text is still used for a11y). */
  children?: ReactNode;
  /** Optional extra classes on the trigger. */
  className?: string;
}

export default function InfoTip({ text, children, className = "" }: Props) {
  const label = text ?? (typeof children === "string" ? children : "More info");
  return (
    <span
      className={`relative inline-flex align-middle group ${className}`}
      tabIndex={0}
      role="button"
      aria-label={label}
      title={label}
    >
      <HelpCircle className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-help" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-56 -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-white shadow-lg group-hover:block group-focus:block dark:bg-gray-700"
      >
        {children ?? text}
      </span>
    </span>
  );
}
