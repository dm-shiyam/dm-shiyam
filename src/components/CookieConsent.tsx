// components/CookieConsent.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      // Small delay so it doesn't flash on first paint
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    localStorage.setItem("cookie_consent_date", new Date().toISOString());
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookie_consent", "declined");
    localStorage.setItem("cookie_consent_date", new Date().toISOString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="
        fixed bottom-4 left-4 right-4 z-50
        sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm
        bg-white dark:bg-gray-900
        border border-gray-200 dark:border-gray-700
        rounded-2xl shadow-lg
        p-5
        animate-in slide-in-from-bottom-4 fade-in duration-300
      "
    >
      {/* Icon + heading */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg" aria-hidden="true">🍪</span>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          We use cookies
        </h2>
      </div>

      {/* Body */}
      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
        We use essential cookies to keep you logged in, and optional analytics
        cookies to improve the platform. No advertising cookies, ever. Read our{" "}
        <Link
          href="/privacy"
          className="underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
        >
          Privacy Policy
        </Link>{" "}
        for details.
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={accept}
          className="
            flex-1 text-xs font-medium py-2 px-3 rounded-lg
            bg-indigo-600 hover:bg-indigo-700
            text-white transition-colors
          "
        >
          Accept all
        </button>
        <button
          onClick={decline}
          className="
            flex-1 text-xs font-medium py-2 px-3 rounded-lg
            border border-gray-300 dark:border-gray-600
            text-gray-700 dark:text-gray-300
            hover:bg-gray-50 dark:hover:bg-gray-800
            transition-colors
          "
        >
          Essential only
        </button>
      </div>
    </div>
  );
}
