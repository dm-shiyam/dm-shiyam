// Next.js instrumentation hook — runs once per server process on startup.
// Registers Sentry for the appropriate runtime.
// See https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forward request errors to Sentry (available in Next 15+)
export { captureRequestError as onRequestError } from "@sentry/nextjs";
