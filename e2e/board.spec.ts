import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { signIn } from "./helpers/auth";

/**
 * The board is the feature with the least unit coverage and the most ways to
 * break: `KanbanBoard`, `KanbanColumn` and `DraggableTaskCard` are all
 * excluded from the unit suite because drag needs real pointer or key events,
 * and the realtime subscription that refreshes it needs a live backend.
 *
 * The drag here is driven with the keyboard rather than the mouse. dnd-kit's
 * `KeyboardSensor` is configured, so this is a supported interaction — and it
 * tests something a pointer drag would not: that the board can be operated
 * without a mouse at all. A synthesised mouse drag is also the flakiest thing
 * one can put in a browser test.
 */

/** `<section aria-label="To do, 4 tasks">` — the count makes a prefix match necessary. */
function column(page: Page, label: string): Locator {
  return page.locator(`section[aria-label^="${label}, "]`);
}

/** dnd-kit puts role=button and aria-roledescription=draggable on each card. */
function cards(scope: Locator): Locator {
  return scope.locator('[aria-roledescription="draggable"]');
}

/** The task title, which is the only stable way to follow a card across a move. */
async function titleOf(card: Locator): Promise<string> {
  const text = (await card.locator("h3").first().textContent())?.trim() ?? "";
  expect(text.length).toBeGreaterThan(0);
  return text;
}

/**
 * Pick the card up and wait until the drag is really active.
 *
 * dnd-kit attaches its keyboard listener when the drag starts, a tick after
 * the Space that starts it. An arrow key sent in that gap reaches nobody: the
 * drag still runs and the drop still fires, but `over` comes back as the
 * column the card started in — which reads exactly like a broken drag rather
 * than a test that pressed a key too early. It cost a long debugging session
 * here, so it is worth the comment.
 *
 * `aria-pressed` is dnd-kit's own signal that the card is lifted, but it flips
 * before the listener is attached, so it is necessary and not sufficient. The
 * short settle after it is a real synchronisation, not padding: there is no
 * DOM signal for "the sensor is now listening".
 */
async function lift(page: Page, card: Locator): Promise<void> {
  await card.focus();
  await page.keyboard.press("Space");
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(300);
}

test.describe("Kanban board", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/board");
    await page.waitForLoadState("networkidle");
  });

  test("shows the seeded columns", async ({ page }) => {
    for (const label of ["To do", "In progress", "Done", "Cancelled"]) {
      await expect(column(page, label)).toBeVisible();
    }
    // The seed puts work on the board; an empty board would make the drag
    // tests below pass vacuously.
    expect(await cards(column(page, "To do")).count()).toBeGreaterThan(0);
  });

  test("moves a task to the next column, and the move survives a reload", async ({ page }) => {
    const todo = column(page, "To do");
    const card = cards(todo).first();
    const title = await titleOf(card);

    const before = await cards(todo).count();

    await lift(page, card);

    /*
     * Arm the wait before the drop, not after.
     *
     * `commitDrop` fires the server action without awaiting it, so the board
     * moves the card optimistically while the write is still in flight.
     * Reloading on the optimistic assertion alone races it and fails looking
     * exactly like "the move was never persisted" — the database said
     * otherwise every time. `networkidle` is not enough either: it can settle
     * before the action's POST is even issued. Waiting on the response itself
     * is the only honest synchronisation.
     */
    const written = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/board"),
    );

    await page.keyboard.press("ArrowRight"); // one press, one column
    await page.keyboard.press("Space"); // drop

    await expect(column(page, "In progress").getByText(title)).toBeVisible();
    await expect(cards(todo)).toHaveCount(before - 1);

    await written;

    // The real assertion: it was persisted, not just moved in local state.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(column(page, "In progress").getByText(title)).toBeVisible();
    await expect(column(page, "To do").getByText(title)).toHaveCount(0);
  });

  test("a cancelled drag leaves the task where it was", async ({ page }) => {
    const todo = column(page, "To do");
    const card = cards(todo).first();
    const title = await titleOf(card);
    const before = await cards(todo).count();

    await lift(page, card);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape"); // abandon the drag

    await expect(cards(todo)).toHaveCount(before);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(column(page, "To do").getByText(title)).toBeVisible();
  });
});
