// S5.3.1 — Regression guards for pages shipped in S5.1.8 (refund policy)
// and S5.1.9 (billing success/cancel). All read-only, no auth required, no
// side effects — safe to run against prod via E2E_BASE_URL.

import { test, expect } from "@playwright/test";

test.describe("Refund policy", () => {
  test("renders with 12 sections + Terms backlink", async ({ page }) => {
    const res = await page.goto("/refund-policy");
    expect(res?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: /refund.*cancellation policy/i })
    ).toBeVisible();

    // All 12 numbered section titles exist. Loose match — only need to know
    // the structure is intact.
    // Each section heading is "N. Title" per the Section helper. Match the
    // full prefix so re-ordering/duplication would break the test.
    const titles = [
      /^1\. overview$/i,
      /^2\. free plan$/i,
      /^3\. 7-day refund window/i,
      /^4\. renewals/i,
      /^5\. pro-rata/i,
      /^6\. non-refundable/i,
      /^7\. how to cancel$/i,
      /^8\. how refunds reach you$/i,
      /^9\. chargebacks/i,
      /^10\. gst/i,
      /^11\. changes to this policy$/i,
      /^12\. contact$/i,
    ];
    for (const t of titles) {
      await expect(page.getByRole("heading", { name: t })).toBeVisible();
    }

    // Must link back to Terms (bidirectional link invariant)
    const termsLink = page.getByRole("link", { name: /terms of service/i });
    await expect(termsLink.first()).toBeVisible();
  });

  test("footer on landing links here", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /^refund policy$/i })
    ).toBeVisible();
  });
});

test.describe("Billing cancel page", () => {
  test("renders a clean 'no charge' message + Try again / Dashboard CTAs", async ({
    page,
  }) => {
    const res = await page.goto("/billing/cancel");
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /checkout cancelled/i })
    ).toBeVisible();
    await expect(page.getByText(/no charge was made/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /try again/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /back to dashboard/i })
    ).toBeVisible();
  });

  test("preserves plan param on the Try again link", async ({ page }) => {
    await page.goto("/billing/cancel?plan=pro");
    const tryAgain = page.getByRole("link", { name: /try again/i });
    const href = await tryAgain.getAttribute("href");
    expect(href).toBe("/pricing?plan=pro");
  });
});

test.describe("Billing success page", () => {
  // Unauthenticated: status fetch returns 401, so we land in the 'error'
  // phase (never active, poll gives up). The page must still render the
  // receipt skeleton without crashing — it is reachable via a shared link
  // or back-button long after the session expired.
  test("renders without crashing even without a session", async ({ page }) => {
    const res = await page.goto(
      "/billing/success?subscription=sub_TEST123&plan=pro&cycle=monthly"
    );
    expect(res?.status()).toBe(200);
    // Shows the plan / amount / subscription-id receipt rows
    await expect(page.getByText(/subscription id/i)).toBeVisible();
    await expect(page.getByText(/sub_TEST123/)).toBeVisible();
    await expect(page.getByText(/pro.*monthly/i)).toBeVisible();
    await expect(page.getByText(/₹799/)).toBeVisible();

    // Both CTAs present
    await expect(
      page.getByRole("link", { name: /open dashboard/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /view all plans/i })
    ).toBeVisible();
  });

  test("yearly cycle shows yearly price (₹7,990 for Pro)", async ({ page }) => {
    await page.goto(
      "/billing/success?subscription=sub_TEST456&plan=pro&cycle=yearly"
    );
    await expect(page.getByText(/pro.*yearly/i)).toBeVisible();
    // Pro yearly = 10 × monthly = ₹7,990 (2 months free). Format in INR
    // locale uses commas, so match loosely.
    await expect(page.getByText(/₹7,?990/)).toBeVisible();
  });

  test("suspense fallback does not deadlock on missing params", async ({
    page,
  }) => {
    // No query params at all — isPlan(planParam) returns null, planConfig
    // is null, so the receipt rows should NOT render but the shell must.
    const res = await page.goto("/billing/success");
    expect(res?.status()).toBe(200);
    // Dashboard CTA still present (not dependent on plan)
    await expect(
      page.getByRole("link", { name: /open dashboard/i })
    ).toBeVisible();
  });
});
