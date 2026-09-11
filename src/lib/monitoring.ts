// Lightweight monitoring wrapper — safe to use anywhere in server code.
//
// If Sentry is initialized (SENTRY_DSN env var set), errors go to Sentry.
// Otherwise, structured console.error output is captured by Vercel logs.
//
// Usage:
//   import { captureError } from "@/lib/monitoring";
//   try { ... } catch (err) { captureError(err, { route: "webhook", commentId }); }

import * as Sentry from "@sentry/nextjs";

type ErrorContext = Record<string, string | number | boolean | null | undefined>;

// ---------------------------------------------------------------------------
// Lazy Sentry init — defensive fallback.
//
// instrumentation.ts *should* have called Sentry.init() at boot. In Next 16 +
// @sentry/nextjs v10 the instrumentation hook has occasionally been observed
// to skip (see docs/SENTRY_SETUP.md § Troubleshooting). This function guarantees
// the SDK is initialized on first use, regardless of what the hook did.
//
// Idempotent: Sentry.getClient() short-circuits if a client already exists.
// ---------------------------------------------------------------------------
let lazyInitAttempted = false;

function ensureSentry(): void {
  if (Sentry.getClient()) return;
  if (lazyInitAttempted) return; // Don't spam init on every call if DSN missing
  lazyInitAttempted = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    Sentry.init({
      dsn,
      environment:
        process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      enabled:
        process.env.NODE_ENV === "production" ||
        process.env.SENTRY_DEBUG === "1",
      ignoreErrors: [
        "NEXT_HTTP_ERROR_FALLBACK",
        "NEXT_NOT_FOUND",
        "NEXT_REDIRECT",
      ],
    });
  } catch (err) {
    // Never let monitoring itself break the caller
    console.error("[monitoring] lazy Sentry init failed", err);
  }
}

/**
 * Capture an error with optional structured context.
 * Always logs to console (visible in Vercel logs) and forwards to Sentry if configured.
 */
export function captureError(error: unknown, context: ErrorContext = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));

  // Always log for Vercel Logs / local console visibility
  console.error("[monitoring]", err.message, {
    stack: err.stack,
    context,
  });

  ensureSentry();

  // Forward to Sentry — no-op if DSN not configured
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) scope.setTag(key, String(value));
      if (value !== undefined) scope.setContext("details", context);
    }
    Sentry.captureException(err);
  });
}

/**
 * Capture a non-error alert message (e.g., payment webhook signature mismatch,
 * suspicious rate-limit hits). Sends as Sentry "warning" level.
 */
export function captureAlert(
  message: string,
  context: ErrorContext = {},
  level: "info" | "warning" | "error" = "warning"
): void {
  console.warn(`[monitoring:${level}]`, message, context);
  ensureSentry();
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) scope.setTag(key, String(value));
    }
    scope.setContext("details", context);
    Sentry.captureMessage(message, level);
  });
}
