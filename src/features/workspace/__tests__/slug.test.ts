import { describe, expect, it } from "vitest";

import { buildSlug, slugify, slugToken } from "../slug";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Daniel Olaniyan")).toBe("daniel-olaniyan");
  });

  it("strips non-alphanumeric characters", () => {
    expect(slugify("hello@world.com")).toBe("hello-world-com");
  });

  it("collapses repeated separators and trims edges", () => {
    expect(slugify("  --Foo___Bar!!  ")).toBe("foo-bar");
  });

  it("falls back to 'workspace' for empty input", () => {
    expect(slugify("")).toBe("workspace");
    expect(slugify("!!!")).toBe("workspace");
  });

  it("caps the base length", () => {
    const long = "a".repeat(80);
    expect(slugify(long).length).toBeLessThanOrEqual(40);
  });
});

describe("slugToken", () => {
  it("produces a 6-char lowercase token from a UUID", () => {
    const token = slugToken("ABCDEF12-3456-7890-ABCD-EF1234567890");
    expect(token).toBe("abcdef");
    expect(token).toHaveLength(6);
  });
});

describe("buildSlug", () => {
  it("joins a slugified base with the token", () => {
    expect(buildSlug("Daniel Olaniyan", "ab12cd")).toBe("daniel-olaniyan-ab12cd");
  });
});
