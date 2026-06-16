import { describe, expect, it } from "vitest";

import { getMonthRange, getWeekRange, toISODate } from "../date";

describe("date", () => {
  describe("getWeekRange", () => {
    it("anchors the week to Monday–Sunday", () => {
      // 2026-06-16 is a Tuesday.
      const range = getWeekRange(new Date("2026-06-16T12:00:00"));
      expect(range.start).toBe("2026-06-15"); // Monday
      expect(range.end).toBe("2026-06-21"); // Sunday
    });

    it("keeps a Monday in its own week", () => {
      const range = getWeekRange(new Date("2026-06-15T00:00:00"));
      expect(range.start).toBe("2026-06-15");
    });
  });

  describe("getMonthRange", () => {
    it("spans the first to last day of the month", () => {
      const range = getMonthRange(new Date("2026-02-10T00:00:00"));
      expect(range.start).toBe("2026-02-01");
      expect(range.end).toBe("2026-02-28");
    });
  });

  describe("toISODate", () => {
    it("formats a Date as YYYY-MM-DD", () => {
      expect(toISODate(new Date("2026-06-16T23:59:00"))).toBe("2026-06-16");
    });
  });
});
