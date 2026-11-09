import { describe, expect, it } from "vitest";

import { columnIndexAt, columnStep } from "../keyboard-coordinates";
import type { ColumnRect } from "../keyboard-coordinates";

/** Four 250px columns, laid out left to right from x=0, as the board renders. */
const COLUMNS: ColumnRect[] = [
  { left: 0, top: 0, width: 250, height: 800 },
  { left: 250, top: 0, width: 250, height: 800 },
  { left: 500, top: 0, width: 250, height: 800 },
  { left: 750, top: 0, width: 250, height: 800 },
];

const RIGHT = "ArrowRight";
const LEFT = "ArrowLeft";

describe("columnIndexAt", () => {
  it("finds the column containing the point", () => {
    expect(columnIndexAt(COLUMNS, 125)).toBe(0);
    expect(columnIndexAt(COLUMNS, 375)).toBe(1);
    expect(columnIndexAt(COLUMNS, 875)).toBe(3);
  });

  it("treats a column's left edge as inside it, and its right edge as the next", () => {
    expect(columnIndexAt(COLUMNS, 250)).toBe(1);
    expect(columnIndexAt(COLUMNS, 249.9)).toBe(0);
  });

  it("falls back to the nearest column for a point outside them all", () => {
    expect(columnIndexAt(COLUMNS, -500)).toBe(0);
    expect(columnIndexAt(COLUMNS, 9999)).toBe(3);
  });
});

describe("columnStep", () => {
  it("moves one column right, landing on its centre", () => {
    expect(columnStep(COLUMNS, { x: 125, y: 400 }, RIGHT)).toEqual({ x: 375, y: 400 });
  });

  it("moves one column left", () => {
    expect(columnStep(COLUMNS, { x: 375, y: 400 }, LEFT)).toEqual({ x: 125, y: 400 });
  });

  it("keeps the vertical position, so a drag does not jump up or down", () => {
    expect(columnStep(COLUMNS, { x: 125, y: 612 }, RIGHT)?.y).toBe(612);
  });

  /** Stopping at the end beats sliding off the board into nothing. */
  it("refuses to move past the last column", () => {
    expect(columnStep(COLUMNS, { x: 875, y: 400 }, RIGHT)).toBeNull();
  });

  it("refuses to move before the first column", () => {
    expect(columnStep(COLUMNS, { x: 125, y: 400 }, LEFT)).toBeNull();
  });

  /** Vertical arrows must stay unclaimed so they still scroll the column. */
  it("ignores keys that are not horizontal arrows", () => {
    for (const code of ["ArrowUp", "ArrowDown", "Space", "Enter", "Tab"]) {
      expect(columnStep(COLUMNS, { x: 125, y: 400 }, code)).toBeNull();
    }
  });

  it("does nothing when no columns have been measured yet", () => {
    expect(columnStep([], { x: 0, y: 0 }, RIGHT)).toBeNull();
  });

  /**
   * One press per column is the whole point. The default getter moves 25px,
   * which on these columns is ten presses for the same move.
   */
  it("crosses the whole board in one press per column", () => {
    let position = { x: 125, y: 400 };
    const visited = [columnIndexAt(COLUMNS, position.x)];

    for (let i = 0; i < 3; i += 1) {
      const next = columnStep(COLUMNS, position, RIGHT);
      expect(next).not.toBeNull();
      position = next!;
      visited.push(columnIndexAt(COLUMNS, position.x));
    }

    expect(visited).toEqual([0, 1, 2, 3]);
  });

  it("handles columns of differing widths", () => {
    const uneven: ColumnRect[] = [
      { left: 0, top: 0, width: 100, height: 800 },
      { left: 100, top: 0, width: 400, height: 800 },
    ];
    expect(columnStep(uneven, { x: 50, y: 10 }, RIGHT)).toEqual({ x: 300, y: 10 });
  });
});
