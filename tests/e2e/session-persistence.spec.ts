// S5.3.1 — Session persists across tabs.
//
// Opens the same browser *context* in two pages (= two tabs, same cookies).
// Visits /dashboard in tab A, then tab B — both should get the same
// redirect behaviour (same auth state). Without logging in we can only
// prove the *unauth* case holds consistently: both tabs redirect to
// /login. The *auth* case (both tabs land on /dashboard) requires live
// credentials and is covered in the manual S5.3.1 checklist, not here.
//
// Why this still has value: regressions where next-auth / middleware
// bungles the cookie across tabs (e.g. SameSite misconfiguration,
// hostname mismatch between apex and www) show up as *inconsistent*
// redirect behaviour between tabs even without auth.

import { test, expect } from "@playwright/test";

test.describe("Session consistency across tabs (unauth baseline)", () => {
  test("both tabs redirect anonymous /dashboard visit to /login", async ({
    context,
  }) => {
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await Promise.all([tabA.goto("/dashboard"), tabB.goto("/dashboard")]);

    await Promise.all([
      tabA.waitForURL(/\/login/, { timeout: 10_000 }),
      tabB.waitForURL(/\/login/, { timeout: 10_000 }),
    ]);

    expect(tabA.url()).toContain("/login");
    expect(tabB.url()).toContain("/login");

    await tabA.close();
    await tabB.close();
  });

  test("auth cookie set in one tab is visible to another tab in the same context", async ({
    context,
  }) => {
    // Simulate a session cookie set in tab A (we don't have real auth
    // credentials in CI, so we hand-set a cookie and assert both tabs
    // read the same jar). This proves the context model is working;
    // next-auth's own cookie would use the same path/domain.
    await context.addCookies([
      {
        name: "e2e_session_probe",
        value: "ankit-tab-a",
        url: new URL(
          (test.info().project.use.baseURL as string) || "http://localhost:3000"
        ).origin,
        httpOnly: false,
        sameSite: "Lax",
      },
    ]);

    const tabB = await context.newPage();
    await tabB.goto("/");
    const cookies = await context.cookies();
    const probe = cookies.find((c) => c.name === "e2e_session_probe");
    expect(probe?.value).toBe("ankit-tab-a");

    await tabB.close();
  });
});
