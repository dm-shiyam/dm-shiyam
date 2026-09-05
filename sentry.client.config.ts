// Sentry client-side (browser) init.
// Captures unhandled errors and promise rejections from React components.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ||
      process.env.NODE_ENV ||
      "development",
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7),

    // 10% of session replays sampled, 100% when there's an error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    enabled:
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_SENTRY_DEBUG === "1",

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,   // hide user input text (privacy)
        blockAllMedia: true, // don't record images/video
      }),
    ],

    ignoreErrors: [
      // Browser extension noise
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      // Network errors from client aborts
      "NetworkError when attempting to fetch resource",
      "The user aborted a request",
      // Third-party script noise
      /^Non-Error promise rejection captured/,
    ],
  });
}
