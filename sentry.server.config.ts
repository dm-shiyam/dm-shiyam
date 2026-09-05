// Sentry server-side init — runs in Node.js runtime routes.
// Only initializes when SENTRY_DSN is set; silently no-ops otherwise.
// See docs/SENTRY_SETUP.md for setup instructions.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),

    // 10% of transactions sampled in prod; 100% in dev for local debugging
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Never send events in development unless explicitly opted in via SENTRY_DEBUG
    enabled:
      process.env.NODE_ENV === "production" || process.env.SENTRY_DEBUG === "1",

    // Scrub common secrets before sending — Sentry does some of this, we add more
    beforeSend(event) {
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, string>;
        for (const key of Object.keys(h)) {
          if (/authorization|cookie|x-hub-signature|token|secret/i.test(key)) {
            h[key] = "[REDACTED]";
          }
        }
      }
      // Redact query params that might leak tokens
      if (event.request?.query_string && typeof event.request.query_string === "string") {
        event.request.query_string = event.request.query_string.replace(
          /(access_token|token|secret|password)=[^&]*/gi,
          "$1=[REDACTED]"
        );
      }
      return event;
    },

    ignoreErrors: [
      // Next.js emits these when a client aborts a request — noise, not bugs
      "NEXT_HTTP_ERROR_FALLBACK",
      "NEXT_NOT_FOUND",
      "NEXT_REDIRECT",
    ],
  });
}
