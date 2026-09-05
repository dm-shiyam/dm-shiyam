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
