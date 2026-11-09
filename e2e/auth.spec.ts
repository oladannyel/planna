import { expect, test } from "@playwright/test";

import { signIn } from "./helpers/auth";

test.describe("authentication", () => {
  test("an unauthenticated visitor is sent to the login page", async ({ page }) => {
    await page.goto("/board");
    await expect(page).toHaveURL(/\/login/);
  });

  /**
   * The session gate is in the proxy, so this is also the test that the
   * security headers reach a redirect — a policy that covers only the happy
   * path has a hole exactly where an unauthenticated visitor lands.
   */
  test("the redirect to login carries the security headers", async ({ page }) => {
    const response = await page.goto("/board");
    const headers = response?.headers() ?? {};

    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("the policy carries a nonce, and a different one each time", async ({ page }) => {
    const first = await page.goto("/login");
    const second = await page.goto("/login");

    const nonceOf = (csp: string | undefined) => csp?.match(/'nonce-([^']+)'/)?.[1];
    const a = nonceOf(first?.headers()["content-security-policy"]);
    const b = nonceOf(second?.headers()["content-security-policy"]);

    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  /**
   * A strict CSP that the app violates is worse than none: it either breaks
   * the page or trains everyone to ignore the console. Nothing the app does
   * on its own pages may be refused by its own policy.
   */
  test("no page loads with a CSP violation", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/Content Security Policy|Refused to (execute|load|apply)/i.test(text)) {
        violations.push(text);
      }
    });

    await signIn(page);
    for (const path of ["/board", "/daily", "/analytics", "/weekly"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }

    expect(violations).toEqual([]);
  });

  test("signing in reaches the app, and signing out returns to login", async ({ page }) => {
    await signIn(page);
    await page.goto("/board");
    await expect(page).toHaveURL(/\/board/);

    // Driven through the real control, not by navigating to the route: the
    // signout handler is POST-only, so a GET to it does nothing at all and a
    // test that did that would pass while signing nobody out.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    // And the session is really gone, not just redirected away from once.
    await page.goto("/board");
    await expect(page).toHaveURL(/\/login/);
  });
});
