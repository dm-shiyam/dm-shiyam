// S5.3.2 — Onboarding flow guardrails that are safe to run unauthenticated
// against prod. The full happy path (signup → wizard → connect IG → create
// automation → self-comment → DM) is in docs/QA_CHECKLIST.md §9 for manual
// validation — it requires real IG credentials and side-effects we can't
// automate.

import { test, expect } from "@playwright/test";

test.describe("Onboarding entry points", () => {
  test("/api/instagram/oauth/authorize bounces unauth user to /login with callback", async ({
    page,
  }) => {
    // Clicking "Connect Instagram" when logged out must punt to /login with
    // the callbackUrl carrying the authorize URL, so re-login resumes the
    // onboarding step cleanly. Was the fix in src/app/api/instagram/oauth/
    // authorize/route.ts.
    const res = await page.goto("/api/instagram/oauth/authorize", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200); // Final /login page is 200
    await expect(page).toHaveURL(/\/login/);
    const url = new URL(page.url());
    const cb = url.searchParams.get("callbackUrl");
    expect(cb).toBe("/api/instagram/oauth/authorize");
  });

  test("unauth OAuth error URL still renders a friendly page, not raw JSON", async ({
    page,
  }) => {
    // /oauth/instagram/error is the pretty error destination the authorize
    // route redirects to when INSTAGRAM_APP_ID is missing in env. Reviewers
    // and support tickets land here, must not show JSON.
    const res = await page.goto(
      "/oauth/instagram/error?code=misconfigured&desc=test"
    );
    expect(res?.status()).toBe(200);
    // The body should be HTML, not application/json
    const ct = res?.headers()["content-type"] ?? "";
    expect(ct).toContain("text/html");
  });
});

test.describe("Dashboard access + onboarding gating", () => {
  test("unauth /dashboard?ig_connected=1 still redirects to /login (does not leak success toast)", async ({
    page,
  }) => {
    // The dashboard's success toast on IG connect reads the query param;
    // if an attacker crafted a URL to make a logged-out observer think
    // they'd connected an account, this guard proves they still can't
    // reach the dashboard without a session.
    await page.goto("/dashboard?ig_connected=1&username=someoneelse");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("unauth /verify-email-pending bounces to /login (gated page)", async ({
    page,
  }) => {
    // Server guard in verify-email-pending/page.tsx: no session → login.
    // Regression: last redesign of auth session cookie had a bug where the
    // page rendered the pending UI anyway. Catch it here.
    await page.goto("/verify-email-pending");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get("next")).toBe("/verify-email-pending");
  });
});

test.describe("Setup Guide (prerequisite documentation)", () => {
  test("Pricing FAQ no longer claims a Facebook Page is required", async ({
    page,
  }) => {
    // Keeps the stale 'Facebook Page required' copy from sneaking back in.
    // The post-IBL migration (Sprint 2) removed this requirement. The FAQ
    // is a React-state accordion, so we expand it first and then assert
    // (a) the no-FB-page phrasing is present, and (b) the old 'you'll need
    // to connect it to a Facebook Page' phrasing is not.
    await page.goto("/pricing");
    const q = page.getByRole("button", {
      name: /do i need an instagram business or creator account/i,
    });
    await expect(q).toBeVisible();
    await q.click();
    const faqRegion = page.locator("div", {
      hasText: /do i need an instagram business or creator account/i,
    }).last();
    await expect(faqRegion).toContainText(/no facebook page required/i);
    await expect(
      page.getByText(/you'll also need to connect it to a Facebook Page/i)
    ).toHaveCount(0);
  });
});
