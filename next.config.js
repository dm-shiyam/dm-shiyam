// -----------------------------------------------------------------------------
// Content-Security-Policy (P12.3)
// -----------------------------------------------------------------------------
// Shipped in REPORT-ONLY mode first: browsers log violations to /api/csp-report
// but nothing is actually blocked. After ~1 week of clean reports (or after
// tightening the allowlist based on what we see), flip CSP_ENFORCE=1 in Vercel
// env to switch the header key to `Content-Security-Policy` (enforcing).
//
// If any legitimate third-party is missing from an allowlist below, users will
// see it as a violation report in Sentry/Vercel logs — add the domain here and
// redeploy. See docs/SENTRY_SETUP.md § CSP for the review workflow.
const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    // Next.js inlines small runtime scripts; removing this requires per-request
    // nonces which conflict with static export routes. Acceptable trade-off.
    "'unsafe-inline'",
    "https://checkout.razorpay.com",
    "https://accounts.google.com",
    "https://apis.google.com",
  ],
  "style-src": [
    "'self'",
    // Tailwind + Next runtime inject inline <style> blocks.
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ],
  // Permissive img-src: user profile pictures come from arbitrary CDNs
  // (Google, Instagram, Gravatar, etc.). Locking this down would break avatars.
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
  "connect-src": [
    "'self'",
    // Razorpay checkout + analytics
    "https://api.razorpay.com",
    "https://lumberjack.razorpay.com",
    // Meta / Instagram Graph
    "https://graph.instagram.com",
    "https://graph.facebook.com",
    "https://api.instagram.com",
    // Google OAuth
    "https://accounts.google.com",
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
    // Sentry ingest (wildcard covers all regions)
    "https://*.ingest.us.sentry.io",
    "https://*.ingest.sentry.io",
    // Vercel Analytics / Speed Insights
    "https://vitals.vercel-insights.com",
  ],
  "frame-src": [
    "'self'",
    "https://checkout.razorpay.com",
    "https://api.razorpay.com",
    "https://accounts.google.com",
  ],
  // Matches X-Frame-Options: DENY — nothing may frame us.
  "frame-ancestors": ["'none'"],
  "form-action": [
    "'self'",
    "https://checkout.razorpay.com",
    "https://accounts.google.com",
  ],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "report-uri": ["/api/csp-report"],
};

const CSP_HEADER_VALUE = Object.entries(CSP_DIRECTIVES)
  .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
  .join("; ");

const CSP_HEADER_KEY =
  process.env.CSP_ENFORCE === "1"
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  serverExternalPackages: ['pg'],
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Control referrer information
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Enforce HTTPS (only in production; browsers ignore on localhost)
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Legacy XSS protection (browsers with older versions)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Content-Security-Policy — see comment block above CSP_DIRECTIVES
          { key: CSP_HEADER_KEY, value: CSP_HEADER_VALUE },
        ],
      },
    ];
  },
};

// Wrap with Sentry only when SENTRY_ORG + SENTRY_PROJECT are set (source map upload).
// If those env vars are unset, we still export the plain config so builds work
// on any machine without Sentry credentials.
let finalConfig = nextConfig;
if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { withSentryConfig } = require("@sentry/nextjs");
  finalConfig = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    disableLogger: true,
    // Automatically tree-shake Sentry logger statements in prod
    automaticVercelMonitors: true,
  });
}

module.exports = finalConfig;
