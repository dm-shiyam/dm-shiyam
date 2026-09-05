// Sentry edge runtime init — for middleware and edge routes.
// We currently have no edge routes, but including this for future-proofing.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    enabled:
      process.env.NODE_ENV === "production" || process.env.SENTRY_DEBUG === "1",
  });
}
