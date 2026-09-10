// V10 — Pretty error page for Instagram OAuth failures.
//
// Historically the OAuth flow returned raw JSON (e.g. from
// /api/instagram/oauth/authorize when INSTAGRAM_APP_ID was unset) or bounced
// silently to /dashboard where a toast might get eaten by a redirect. Neither
// gave the user a clear "what happened / what do I do" moment.
//
// This page is the single landing spot for every hard OAuth failure. It reads
// `code` and `desc` from the query string, maps `code` to a friendly message,
// and always offers a one-click Retry + a link to support docs.
//
// The map here is intentionally duplicated with the toast copy in
// AccountsTab.tsx — same source of truth for the human-readable strings so
// support tickets look identical whether the user saw a toast or this page.

import Link from "next/link";
import { Instagram, AlertTriangle, RefreshCw, LifeBuoy } from "lucide-react";

export const dynamic = "force-dynamic";

// Keep in sync with OAUTH_ERROR_MESSAGES in src/components/AccountsTab.tsx.
const ERROR_MESSAGES: Record<string, { title: string; body: string; retryable: boolean }> = {
  missing_params: {
    title: "Instagram did not return an authorization code",
    body: "The redirect came back without the code we need. This usually means the flow was interrupted. Please try connecting again.",
    retryable: true,
  },
  bad_state: {
    title: "Your session expired",
    body: "The link you used is no longer valid — this happens if the flow sits idle for more than a few minutes. Start over and it will work.",
    retryable: true,
  },
  misconfigured: {
    title: "Instagram login isn't configured on our end",
    body: "Our server is missing the Instagram app credentials. This is on us — the team has been notified. Please try again in a few minutes, or contact support.",
    retryable: false,
  },
  code_exchange_failed: {
    title: "Instagram rejected the authorization code",
    body: "Meta refused the code we sent — usually because it was already used or expired. A fresh attempt should work.",
    retryable: true,
  },
  code_exchange_error: {
    title: "We could not reach Instagram",
    body: "The network request to Instagram failed. Check your connection and try again.",
    retryable: true,
  },
  long_lived_failed: {
    title: "Could not obtain a long-lived access token",
    body: "Instagram gave us a short token but refused to upgrade it to the 60-day version. Retry, and if it keeps failing please contact support.",
    retryable: true,
  },
  long_lived_error: {
    title: "Network error while extending the access token",
    body: "The request to Instagram timed out. Please retry.",
    retryable: true,
  },
  profile_fetch_failed: {
    title: "Could not read your Instagram profile",
    body: "Meta accepted the token but the profile lookup failed. Make sure the Instagram account is a Business or Creator account, then retry.",
    retryable: true,
  },
  profile_fetch_error: {
    title: "Network error while reading your Instagram profile",
    body: "The profile lookup request timed out. Please retry.",
    retryable: true,
  },
  already_connected: {
    title: "This Instagram account is already connected",
    body: "Another DM Shiyam user has already linked this Instagram account. If you believe this is a mistake, contact support and we'll help you claim it.",
    retryable: false,
  },
  persist_failed: {
    title: "We could not save your account",
    body: "The connection with Instagram worked but our database refused to save it. This is on us — please retry, and if it keeps happening contact support.",
    retryable: true,
  },
  access_denied: {
    title: "You cancelled the Instagram authorization",
    body: "No worries — nothing was connected. Click Retry when you're ready to try again.",
    retryable: true,
  },
};

const DEFAULT_ERROR = {
  title: "Something went wrong connecting Instagram",
  body: "We hit an unexpected error during the Instagram login flow. Please retry, and if it keeps happening contact support with the details below.",
  retryable: true,
};

type SearchParams = { code?: string; desc?: string };

export default async function InstagramOAuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const code = params.code || "unknown";
  const desc = params.desc || "";
  const meta = ERROR_MESSAGES[code] || DEFAULT_ERROR;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-orange-400 flex items-center justify-center">
              <Instagram className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center ring-2 ring-white dark:ring-gray-900">
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-red-600 dark:text-red-400">
              Instagram connection failed
            </p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
              {meta.title}
            </h1>
          </div>
        </div>

        <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
          {meta.body}
        </p>

        {desc && (
          <div className="mb-6 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Technical detail
            </p>
            <code className="text-sm text-gray-800 dark:text-gray-200 break-words">
              {desc}
            </code>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {meta.retryable && (
            <Link
              href="/api/instagram/oauth/authorize"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white font-semibold hover:opacity-90 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Retry connection
            </Link>
          )}
          <Link
            href="/dashboard"
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            <LifeBuoy className="w-4 h-4" />
            Still stuck? Contact support with error code{" "}
            <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">
              {code}
            </code>
          </Link>
        </div>
      </div>
    </div>
  );
}
