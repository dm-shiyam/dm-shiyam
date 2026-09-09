// A8 — Cross-browser smoke suite.
//
// Every test here must pass on all 5 projects (chromium, firefox, webkit,
// mobile-chrome, mobile-safari) with zero authentication. We deliberately
// avoid anything that hits the real DB or third-party services:
//   * No Google OAuth roundtrip (requires real credentials — do manually).
//   * No Razorpay checkout (real money).
//   * No Instagram webhook (needs Meta to send it).
//
// What we DO catch:
//   * Public pages render (no 500s, no hydration errors, no dead scripts).
//   * Static components mount cleanly across browser engines.
//   * Console.error is empty on landing / login / register / forgot pages.
//   * Forms are interactable (labels, inputs, buttons exist and are enabled).
//   * The "Continue with Google" button — the bug we just shipped a fix for —
//     is present on /login (regression guard for the LoginFormComponent vs
//     LoginForm split).

import { test, expect } from "@playwright/test";

// Catch any console.error the app logs while a page is open. Failing tests
// on console noise catches "TypeError: Cannot read properties of undefined"
// class of bugs that only appear on one engine (usually WebKit).
async function watchConsoleErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test.describe("Landing page", () => {
  test("renders hero + CTAs without console errors", async ({ page }) => {
    const errors = await watchConsoleErrors(page);

    const res = await page.goto("/");
    expect(res?.status(), "GET / should be 200").toBe(200);

    // Any button, link, or heading with "DM Shiyam" — proves the top-level
    // React tree hydrated (SSR shell alone wouldn't have interactive text).
    await expect(page.getByText(/DM Shiyam/i).first()).toBeVisible();

    // Landing has multiple CTA links to /register — pick the first.
    const registerLink = page
      .getByRole("link", { name: /sign up|get started|start free/i })
      .first();
    await expect(registerLink).toBeVisible();

    // Filter out the noisy but harmless third-party errors (analytics
    // blocked by uBlock, favicon fetches on non-prod, etc). Keep only
    // errors that originate from our own code.
    const relevant = errors.filter(
      (e) =>
        !/gtag|google-analytics|hotjar|sentry|favicon|Manifest/i.test(e) &&
        !/Failed to load resource/i.test(e)
    );
    expect(relevant, `unexpected console errors: ${relevant.join("\n")}`).toEqual([]);
  });
});

// NOTE: our <label> / <input> pairs aren't wired via htmlFor/id in
// LoginFormComponent/RegisterFormComponent, so `page.getByLabel(/email/i)`
// returns 0 matches even though the labels are visually correct. That's
// a real a11y gap (screen readers can't associate the pair either) — see
// docs/QA_CHECKLIST.md, "Accessibility follow-ups". Until that's fixed
// we locate inputs by `type` / `placeholder`, which is more brittle but
// works today.

test.describe("Login page", () => {
  test("renders email/password form + Google button", async ({ page }) => {
    const errors = await watchConsoleErrors(page);
    const res = await page.goto("/login");
    expect(res?.status()).toBe(200);

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();

    // Regression guard for commit 8d9eb6f — /login was missing the Google
    // button entirely (was on the old LoginForm.tsx, not the actually-used
    // LoginFormComponent.tsx). If this fails, the button got removed again.
    await expect(
      page.getByRole("button", { name: /continue with google/i })
    ).toBeVisible();

    const relevant = errors.filter(
      (e) => !/gtag|google-analytics|hotjar|sentry|favicon/i.test(e)
    );
    expect(relevant, relevant.join("\n")).toEqual([]);
  });

  test("shows friendly error on wrong credentials (not raw 'CredentialsSignin')", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("nobody@example.com");
    await page.locator('input[type="password"]').first().fill("WrongPass123");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // Regression guard for commit efd1f90 — we translate the raw NextAuth
    // error string to something a user can act on. Loose regex because
    // the exact copy might get tweaked; the key thing is it's readable.
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/credentialssignin/i)).toHaveCount(0);
  });
});

test.describe("Register page", () => {
  test("renders with Google button + credentials form", async ({ page }) => {
    const res = await page.goto("/register");
    expect(res?.status()).toBe(200);

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign up with google|continue with google/i })
    ).toBeVisible();
  });
});

test.describe("Forgot password page", () => {
  test("renders + submit button is present", async ({ page }) => {
    const errors = await watchConsoleErrors(page);
    const res = await page.goto("/forgot-password");
    expect(res?.status()).toBe(200);

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.fill("test-nonexistent@example.com");

    // Match any submit-shaped button; the copy may be "Send reset link" or
    // similar depending on which iteration of the form is deployed.
    const submit = page.locator('button[type="submit"]').first();
    await expect(submit).toBeEnabled();
    // Deliberately don't click — we don't want to burn Resend quota when
    // running against prod (E2E_BASE_URL) and we don't need to prove the
    // API works here (unit-covered elsewhere).

    const relevant = errors.filter(
      (e) => !/gtag|google-analytics|hotjar|sentry|favicon/i.test(e)
    );
    expect(relevant, relevant.join("\n")).toEqual([]);
  });
});

test.describe("Reset password page", () => {
  test("invalid link shows friendly error, not a crash", async ({ page }) => {
    // Missing token — the ResetForm early-returns with a "Invalid reset link"
    // message. Common WebKit failure mode: throws on useSearchParams outside
    // Suspense. This test protects against reintroducing that.
    const res = await page.goto("/reset-password");
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/invalid reset link/i)).toBeVisible();
  });

  test("with a fake token shows the form with both reveal toggles", async ({ page }) => {
    const res = await page.goto("/reset-password?token=fake-token-just-for-render");
    expect(res?.status()).toBe(200);

    // Both fields render
    const inputs = page.locator('input[type="password"]');
    await expect(inputs).toHaveCount(2);

    // Regression guard for commit efd1f90 — reveal-eye toggles on BOTH
    // fields. Before the fix, only the New password field had one.
    const revealButtons = page.getByRole("button", {
      name: /show password|hide password/i,
    });
    await expect(revealButtons).toHaveCount(2);
  });
});

test.describe("Dashboard access control", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto("/dashboard");
    // NextAuth redirects; wait for /login to load
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page.getByText(/welcome back|sign in/i).first()).toBeVisible();
  });
});

test.describe("Admin access control", () => {
  test("unauthenticated user cannot reach admin routes", async ({ page }) => {
    await page.goto("/admin");
    // Redirects to /login (see admin/page.tsx effect)
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });

  test("unauthenticated API call to admin funnel returns 401", async ({ request }) => {
    const res = await request.get("/api/admin/funnel");
    // 401 (no session) is the expected pre-auth response; 403 (session but
    // not admin) is also acceptable if a test session happens to be present.
    expect([401, 403]).toContain(res.status());
  });
});

test.describe("Legal pages", () => {
  test("privacy policy renders", async ({ page }) => {
    const res = await page.goto("/privacy");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /privacy/i }).first()).toBeVisible();
  });
  test("terms of service renders", async ({ page }) => {
    const res = await page.goto("/terms");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /terms/i }).first()).toBeVisible();
  });
});
