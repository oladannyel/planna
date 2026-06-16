import { describe, expect, it } from "vitest";

import { cn } from "../cn";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("applies conditional object syntax", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });

  it("resolves conflicting Tailwind classes (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("merges arrays of classes", () => {
    expect(cn(["text-sm", "font-bold"])).toBe("text-sm font-bold");
  });
});
