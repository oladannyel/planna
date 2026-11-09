import { KeyboardCode } from "@dnd-kit/core";
import type { KeyboardCoordinateGetter } from "@dnd-kit/core";

/**
 * Column-aware keyboard dragging.
 *
 * dnd-kit's default keyboard coordinate getter moves the dragged item a flat
 * 25px per arrow press. On a board whose columns are ~250px wide that means
 * ten presses to move a task one column — measured, not guessed — with no
 * feedback along the way to say whether it has crossed yet. A mouse user does
 * it in one gesture. That is the difference between an interaction that is
 * technically reachable by keyboard and one that is usable by keyboard, and
 * only the second is worth anything to someone who cannot use a pointer.
 *
 * This maps one arrow press to one column: left and right step between
 * columns and land on the centre of the target, which is the point the
 * collision detection resolves against.
 */

/** The horizontal order of the board's columns, left to right. */
export type ColumnRect = { left: number; top: number; width: number; height: number };

/**
 * Index of the column containing `x`, or the nearest one when the dragged
 * card sits in a gap between columns.
 */
export function columnIndexAt(rects: readonly ColumnRect[], x: number): number {
  const containing = rects.findIndex((rect) => x >= rect.left && x < rect.left + rect.width);
  if (containing !== -1) return containing;

  let nearest = 0;
  let shortest = Number.POSITIVE_INFINITY;
  rects.forEach((rect, index) => {
    const distance = Math.abs(rect.left + rect.width / 2 - x);
    if (distance < shortest) {
      shortest = distance;
      nearest = index;
    }
  });
  return nearest;
}

/**
 * Where an arrow press should move the dragged card.
 *
 * Returns null for keys that are not horizontal arrows, and for a press that
 * would leave the board — stopping at the end is better than silently doing
 * nothing visible halfway through a drag.
 */
export function columnStep(
  rects: readonly ColumnRect[],
  current: { x: number; y: number },
  code: string,
): { x: number; y: number } | null {
  if (rects.length === 0) return null;

  // Compared as strings: `code` arrives from a KeyboardEvent, which types it
  // as string, and comparing that to the enum member directly is unsound.
  const RIGHT: string = KeyboardCode.Right;
  const LEFT: string = KeyboardCode.Left;
  const direction = code === RIGHT ? 1 : code === LEFT ? -1 : 0;
  if (direction === 0) return null;

  const from = columnIndexAt(rects, current.x);
  const to = from + direction;
  if (to < 0 || to >= rects.length) return null;

  const origin = rects[from];
  const target = rects[to];
  if (!origin || !target) return null;

  /*
   * Translate by the distance between the two columns' centres, rather than
   * placing the card at the target's centre.
   *
   * dnd-kit reports `currentCoordinates` as the top-left of the dragged
   * card's collision rect, not its middle. Moving that corner onto a column's
   * centre leaves the card straddling the boundary into the column after it,
   * which the collision detection then resolves to the wrong column — the
   * first version of this did exactly that, and the card never landed where
   * the arrow key said it would. A centre-to-centre delta keeps the card's
   * offset within its column and so lands cleanly whatever its width.
   */
  const delta = target.left + target.width / 2 - (origin.left + origin.width / 2);
  return { x: current.x + delta, y: current.y };
}

/**
 * Adapter from the pure logic above to dnd-kit's sensor API.
 *
 * `statuses` is the column order; the droppable id of each column is its
 * status, which is what `KanbanColumn` registers with `useDroppable`.
 */
export function createColumnCoordinateGetter(
  statuses: readonly string[],
): KeyboardCoordinateGetter {
  return (event, { context, currentCoordinates }) => {
    const rects = statuses
      .map((status) => context.droppableRects.get(status))
      .filter((rect): rect is NonNullable<typeof rect> => rect != null)
      .map((rect) => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }));

    const next = columnStep(rects, currentCoordinates, event.code);
    if (!next) return undefined;

    // Only claim the key once a move is actually produced, so vertical arrows
    // keep scrolling the column the way they would without a drag in progress.
    event.preventDefault();
    return next;
  };
}
