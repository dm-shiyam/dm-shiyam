// A8 — Cross-browser + device E2E smoke tests.
//
// Goal: catch functional regressions across Chromium, Firefox, WebKit, and
// mobile viewports in one command. Visual bugs (spacing, dark-mode colors,
// backdrop-filter) still need a human eye — see docs/QA_CHECKLIST.md.
//
// Run:
//   pnpm test:e2e              # headless, all browsers
//   pnpm test:e2e:ui           # interactive UI runner (Playwright's picker)
//   pnpm test:e2e:headed       # see the browsers pop open
//   pnpm test:e2e --project=chromium   # single project
//
// The suite spins up `next dev` locally on port 3000 (via webServer below),
// so no need to manually run `pnpm dev` first. If port 3000 is already in
// use, Playwright reuses that server — handy when iterating.

import { defineConfig, devices } from "@playwright/test";

// If you set `E2E_BASE_URL=https://dm-shiyam.vercel.app` in your shell, the
// suite runs against prod instead of localhost. Handy for smoke-testing a
// deploy without spinning up the dev server.
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const usingRemote = baseURL.startsWith("http") && !baseURL.includes("localhost");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox",  use: { ...devices["Desktop Firefox"] } },
    { name: "webkit",   use: { ...devices["Desktop Safari"] } },
    // Mobile emulation — layout parity check. Real iOS Safari for OAuth
    // still needs a physical device (cookie / ITP behavior differs).
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],

  webServer: usingRemote
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
