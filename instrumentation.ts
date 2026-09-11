// Next.js instrumentation hook — runs once per server process on startup.
// Initializes Sentry directly here (recommended pattern for Sentry v10 +
// Next 15/16). Earlier versions used dynamic imports of sentry.server.config.ts,
// but that path proved unreliable in Next 16 — the bundler occasionally dropped
// the module, leaving the SDK uninitialized in production.
// See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

import * as Sentry from "@sentry/nextjs";

/** Shared Sentry.init config used by both node + edge runtimes. */
function sentryInitOptions(): Parameters<typeof Sentry.init>[0] | null {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  return {
    dsn,
    environment:
      process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),

    // 10% of transactions in prod, 100% in dev.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    enabled:
      process.env.NODE_ENV === "production" ||
      process.env.SENTRY_DEBUG === "1",

    // Scrub common secret-bearing request headers + query params before send.
    beforeSend(event) {
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, string>;
        for (const key of Object.keys(h)) {
          if (/authorization|cookie|x-hub-signature|token|secret/i.test(key)) {
            h[key] = "[REDACTED]";
          }
        }
      }
      if (
        event.request?.query_string &&
        typeof event.request.query_string === "string"
      ) {
        event.request.query_string = event.request.query_string.replace(
          /(access_token|token|secret|password)=[^&]*/gi,
          "$1=[REDACTED]"
        );
      }
      return event;
    },

    ignoreErrors: [
      // Next.js emits these on client aborts / rewrites — noise, not bugs.
      "NEXT_HTTP_ERROR_FALLBACK",
      "NEXT_NOT_FOUND",
      "NEXT_REDIRECT",
    ],
  };
}

export async function register() {
  const opts = sentryInitOptions();

  // Log once at boot so we can grep Vercel logs to prove init actually ran.
  // Never logs the DSN itself — just whether it was present.
  // eslint-disable-next-line no-console
  console.log(
    `[sentry-init] runtime=${process.env.NEXT_RUNTIME} dsn_set=${Boolean(
      opts
    )} node_env=${process.env.NODE_ENV}`
  );

  if (!opts) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(opts);
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(opts);
  }
}

// Forward request errors from App Router route handlers into Sentry.
// Requires Sentry.init() to have already run in `register()` above.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
