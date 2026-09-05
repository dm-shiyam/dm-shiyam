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
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) scope.setTag(key, String(value));
    }
    scope.setContext("details", context);
    Sentry.captureMessage(message, level);
  });
}
