import { describe, expect, it } from "vitest";

import { ownerDisplayName } from "../owner";

describe("ownerDisplayName", () => {
  it("prefers the name the owner set over anything derived", () => {
    expect(ownerDisplayName({ display_name: "Daniel" }, "productai's workspace")).toBe("Daniel");
  });

  it("falls back to an OAuth full name", () => {
    expect(ownerDisplayName({ full_name: "Ada Lovelace" }, null)).toBe("Ada Lovelace");
  });

  it("strips the generated wrapper off the workspace name", () => {
    expect(ownerDisplayName(null, "daniel's workspace")).toBe("daniel");
    expect(ownerDisplayName(null, "daniel’s workspace")).toBe("daniel");
  });

  it("keeps a workspace name that was not generated", () => {
    expect(ownerDisplayName(null, "Platform Team")).toBe("Platform Team");
  });

  it("ignores blank and non-string metadata", () => {
    expect(ownerDisplayName({ display_name: "   ", full_name: 42 }, null)).toBeNull();
  });

  it("returns null when there is nothing to show, so the heading stays generic", () => {
    expect(ownerDisplayName(undefined, undefined)).toBeNull();
    expect(ownerDisplayName(null, "'s workspace")).toBeNull();
  });
});
