import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { signIn } from "./helpers/auth";

/**
 * Age classification spans server rendering (the daily sections), a client
 * component's own clock (the card badge) and interactive filtering (the board
 * age row) — three things the unit suite cannot see together, since it stubs
 * the realtime hook and never resolves "today" against a real request.
 *
 * The seeded workspace (supabase/seed.sql) spreads tasks across the days
 * before today, which is exactly the shape this feature exists for.
 */
const SHOTS = "test-results/task-age";

test.describe("task age", () => {
  test("the board can be narrowed to a single day", async ({ page }) => {
    await signIn(page);
    await page.goto("/board");

    /* The seed creates nothing today, so "Today" would otherwise be 0 — a
     * filter that hides everything proves less than one that keeps a card. */
    await addTask(page, "Something started today");

    const ageRow = page.getByRole("tablist", { name: "Filter tasks by age" });
    await expect(ageRow).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/board-all.png`, fullPage: true });

    /* Every task, split across the three buckets with nothing lost. */
    const anyDay = await countOf(ageRow, "Any day");
    const today = await countOf(ageRow, "Today");
    const yesterday = await countOf(ageRow, "Yesterday");
    const older = await countOf(ageRow, "Older");
    expect(today + yesterday + older).toBe(anyDay);

    await ageRow.getByRole("tab", { name: /^Today,/ }).click();
    await expect(ageRow.getByRole("tab", { name: /^Today,/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.screenshot({ path: `${SHOTS}/board-today.png`, fullPage: true });

    /* The status row now describes the chosen day, not the whole board. */
    const statusRow = page.getByRole("tablist", { name: "Filter tasks by status" });
    expect(await countOf(statusRow, "All tasks")).toBe(today);

    expect(today).toBeGreaterThan(0);
    const visible = await page.locator('[aria-roledescription="draggable"]').count();
    expect(visible).toBe(today);
  });

  test("the daily list separates today's tasks from the carried-over ones", async ({ page }) => {
    await signIn(page);
    await page.goto("/daily");

    /*
     * The seed spreads tasks over the days before today and deliberately
     * creates none today — so the "Created today" section has to be earned
     * by adding one, which is also the path a user takes.
     */
    await addTask(page, "Something started today");

    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings).toContain("Created today");
    expect(headings).toContain("Carried over from yesterday");
    /* Oldest section leads the day. */
    expect(headings.indexOf("Created today")).toBe(headings.length - 1);

    await page.screenshot({ path: `${SHOTS}/daily.png`, fullPage: true });
  });

  test("an open task's card says how long it has been waiting", async ({ page }) => {
    await signIn(page);
    await page.goto("/daily");

    const yesterdaySection = page.locator("section", {
      has: page.getByRole("heading", { level: 2, name: "Carried over from yesterday" }),
    });
    const badge = yesterdaySection.locator('[title="Carried over from yesterday"]').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText("1d");

    /* A task created today carries no age badge at all. */
    await addTask(page, "Another one started today");
    const todaySection = page.locator("section", {
      has: page.getByRole("heading", { level: 2, name: "Created today" }),
    });
    await expect(todaySection.locator('[title*="Carried over"]')).toHaveCount(0);
  });
});

/**
 * Add a task the way a user does — the manual path, which makes no model call.
 *
 * The wait is on the card, not on QuickAdd's confirmation. The confirmation
 * names the task too and renders the moment the action returns, so waiting on
 * the text alone let the test read the board's counts a render too early and
 * see the new task missing from them.
 */
async function addTask(page: Page, title: string): Promise<void> {
  await page.getByLabel("New task").fill(title);
  await page.getByRole("button", { name: "Add manually" }).click();
  await expect(page.locator("h3", { hasText: title })).toBeVisible();
}

/** Reads the count out of a tab's accessible name: "Older, 7 tasks". */
async function countOf(row: Locator, label: string): Promise<number> {
  const tab = row.getByRole("tab", { name: new RegExp(`^${label},`) });
  const name = await tab.getAttribute("aria-label");
  const match = name?.match(/,\s*(\d+)\s+task/);
  expect(match).not.toBeNull();
  return Number(match![1]);
}
