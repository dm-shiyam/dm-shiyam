// S5.3.3 — Billing flow guardrails that are safe to run unauthenticated
// against prod. Full live-money happy path (checkout → UPI → webhook →
// plan flip → cancel → grace → downgrade) is covered manually in
// docs/QA_CHECKLIST.md §10 — Razorpay doesn't support test-money charges
// against live keys and we don't want to simulate payment success without
// a webhook, which would be an incorrect state model.

import { test, expect } from "@playwright/test";

test.describe("Billing API — auth + method guards", () => {
  test("GET /api/billing/webhook returns 405 (POST-only)", async ({ request }) => {
    const res = await request.get("/api/billing/webhook");
    expect(res.status()).toBe(405);
  });

  test("POST /api/billing/checkout without session → 401", async ({ request }) => {
    const res = await request.post("/api/billing/checkout", {
      data: { plan: "pro", cycle: "monthly" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/billing/cancel without session → 401", async ({ request }) => {
    const res = await request.post("/api/billing/cancel");
    expect(res.status()).toBe(401);
  });

  test("GET /api/billing/status without session → 401", async ({ request }) => {
    const res = await request.get("/api/billing/status");
    expect(res.status()).toBe(401);
  });

  test("POST /api/billing/webhook with bogus signature → 400 (fail-closed)", async ({
    request,
  }) => {
    // Fail-closed guarantee: any webhook request that doesn't carry a
    // valid HMAC-SHA256 signature over the raw body must be rejected
    // before touching any user state. We send a plausible envelope with
    // garbage in the signature header.
    const res = await request.post("/api/billing/webhook", {
      data: {
        event: "subscription.activated",
        payload: { subscription: { entity: { id: "sub_FAKE" } } },
      },
      headers: {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": "deadbeef".repeat(8),
        "x-razorpay-event-id": "evt_e2e_fake",
      },
    });
    expect([400, 401]).toContain(res.status());
  });
});

test.describe("Pricing page — plan display + checkout entry", () => {
  test("renders live INR prices from PLANS (not hardcoded)", async ({ page }) => {
    await page.goto("/pricing");

    // Monthly default. Each self-serve paid tier's price_label must appear
    // at least once. Agency has no self-serve price (talk-to-sales band),
    // so we check Starter / Pro / Business only. Guards against the
    // ₹99/₹999 regression documented in QA_CHECKLIST §5 bug 5.
    const monthlyLabels = ["₹149", "₹799", "₹2,499"];
    for (const label of monthlyLabels) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test("yearly toggle switches to yearly prices (10× monthly, 2 months free)", async ({
    page,
  }) => {
    await page.goto("/pricing");

    // Billing toggle buttons use role="tab" (not button) so getByRole
    // needs to match that. The accessible name is "Yearly 2 MONTHS FREE"
    // because of the inline savings badge — regex handles the gap.
    const yearlyToggle = page.getByRole("tab", { name: /yearly/i });
    await expect(yearlyToggle).toBeVisible();
    await yearlyToggle.click();

    // 10 × monthly for each self-serve paid tier. Agency is intentionally
    // "talk to sales" (no self-serve price shown) per the Q1-2027 roadmap
    // note in PricingContent.tsx, so we only check Starter / Pro / Business.
    const yearlyLabels = ["₹1,490", "₹7,990", "₹24,990"];
    for (const label of yearlyLabels) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test("unauth 'Subscribe' click routes to /register with callbackUrl carrying plan intent", async ({
    page,
  }) => {
    await page.goto("/pricing");

    // Pick the Pro tier Subscribe button. Pro always shows the
    // "Most popular" badge so it's the most stable thing to target.
    const subscribe = page
      .getByRole("button", { name: /subscribe|get started|start pro/i })
      .first();
    await expect(subscribe).toBeVisible();
    await subscribe.click();

    await page.waitForURL(/\/register/, { timeout: 10_000 });
    const url = new URL(page.url());
    const cb = url.searchParams.get("callbackUrl");
    expect(cb).toBeTruthy();
    // The intent must round-trip the plan so post-register we resume
    // the correct tier's checkout.
    expect(decodeURIComponent(cb || "")).toContain("/pricing?plan=");
  });
});

test.describe("Billing-flow pages (receipt + cancel landing)", () => {
  test("/billing/success shows receipt scaffold even with no session", async ({
    page,
  }) => {
    const res = await page.goto(
      "/billing/success?subscription=sub_SMOKE&plan=starter&cycle=monthly"
    );
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/sub_SMOKE/)).toBeVisible();
    await expect(page.getByText(/₹149/)).toBeVisible(); // Starter monthly
    await expect(
      page.getByRole("link", { name: /open dashboard/i })
    ).toBeVisible();
  });

  test("/billing/cancel is static and does not require auth", async ({ page }) => {
    const res = await page.goto("/billing/cancel");
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /checkout cancelled/i })
    ).toBeVisible();
  });
});
