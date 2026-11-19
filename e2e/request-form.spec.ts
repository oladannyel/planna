import { expect, test } from "@playwright/test";

/**
 * The public request form, seen as a stranger sees it: no session, no cookie,
 * nothing but the link.
 *
 * The heading is the assertion that matters. Someone following this link is
 * writing to a person — the person who sent it — and a form headed only
 * "Submit a request" reads like a generic contact page. The name is resolved
 * server-side from the slug, so this also proves the slug → workspace → owner
 * lookup works against a real database rather than only in unit mocks.
 */
test.describe("public request form", () => {
  test("names the person whose link it is", async ({ page }) => {
    await page.goto("/request/demo");

    // The seeded workspace is "Demo Workspace"; the owner has set no display
    // name, so the workspace name is what requesters see.
    await expect(page.getByRole("heading", { name: /^Submit a request to / })).toBeVisible();
  });

  test("stays anonymous for a link that matches no workspace", async ({ page }) => {
    await page.goto("/request/not-a-real-slug-000000");

    await expect(page.getByRole("heading", { name: "Submit a request" })).toBeVisible();
    // Still rendered rather than 404ing: the form exists, and an unknown slug
    // is answered at submit time by the throttled path.
    await expect(page.getByLabel("Your name")).toBeVisible();
  });
});
