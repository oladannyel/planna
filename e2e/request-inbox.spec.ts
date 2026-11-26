import { expect, test } from "@playwright/test";

import { signIn } from "./helpers/auth";

/**
 * The whole request round trip, against a real database: a colleague files a
 * request, it waits for a decision instead of appearing on the board, the
 * owner accepts it, and the requester's status page follows it.
 *
 * This is the integration proof for ADR 0001. The unit suite mocks Supabase,
 * so it can show that the right rows *would* be written; only this can show
 * that RLS lets the owner read them, that the accept writes a task the board
 * then renders, and that the token page resolves without a session.
 */
test.describe("request inbox", () => {
  // Unique per run: the specs share one seeded workspace, so a fixed title
  // would collide with the row left by the previous run.
  const title = `Audit the vendor contract ${Date.now()}`;

  test("a filed request waits for a decision, and the requester can follow it", async ({
    page,
  }) => {
    await page.goto("/request/demo");

    await page.getByLabel("Your name").fill("Ada Lovelace");
    await page.getByLabel("Your email", { exact: false }).fill("ada@example.com");
    await page.getByLabel("Title").fill(title);
    await page
      .getByLabel("Details")
      .fill("Clauses 7 to 11 need a second pair of eyes before Friday.");
    await page.getByRole("button", { name: "Submit request" }).click();

    // "Sent", not "added": nothing is on the board until the owner accepts.
    await expect(page.getByRole("heading", { name: "Request sent" })).toBeVisible();

    const statusLink = page.getByRole("link", { name: /\/request\/status\// });
    await expect(statusLink).toBeVisible();
    const statusUrl = await statusLink.getAttribute("href");
    expect(statusUrl).toMatch(/\/request\/status\/[0-9a-f]{32}$/);

    // The status page needs no account — the token is the authorisation.
    await page.goto(statusUrl!);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Waiting for a decision")).toBeVisible();

    // The owner sees it waiting, and accepting puts it on the board.
    await signIn(page);
    await page.goto("/requests");

    const card = page.locator("li").filter({ hasText: title });
    await expect(card.getByText("Waiting on you")).toBeVisible();
    await card.getByRole("button", { name: "Accept" }).click();

    // `.first()`: the toast that confirms the accept also says "Accepted",
    // and it overlaps the card's own badge in the accessibility tree.
    await expect(card.getByText("Accepted").first()).toBeVisible();

    await page.goto("/board");
    await expect(page.getByText(title)).toBeVisible();

    // And the requester's page, still without a session, now says so.
    await page.context().clearCookies();
    await page.goto(statusUrl!);
    await expect(page.getByText("Filed by Ada Lovelace")).toBeVisible();
    await expect(page.getByText("Not started yet.")).toBeVisible();
  });

  test("an unknown status token is not distinguishable from a deleted one", async ({ page }) => {
    const response = await page.goto(`/request/status/${"0".repeat(32)}`);
    expect(response?.status()).toBe(404);
  });
});
