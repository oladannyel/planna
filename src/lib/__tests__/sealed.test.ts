import { randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  env: { EMAIL_TOKEN_KEY: undefined as string | undefined },
}));

vi.mock("@/lib/env", () => ({
  get env() {
    return h.env;
  },
}));

const { seal, open, sealingConfigured, SealError } = await import("../sealed");

const KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");

beforeEach(() => {
  h.env.EMAIL_TOKEN_KEY = KEY;
});

describe("seal / open", () => {
  it("round-trips a refresh token", () => {
    const token = "1//0g-fake-refresh-token";
    expect(open(seal(token))).toBe(token);
  });

  it("produces a different ciphertext every time", () => {
    expect(seal("same")).not.toBe(seal("same"));
  });

  it("is versioned, so the scheme can be rotated later", () => {
    expect(seal("x").startsWith("v1:")).toBe(true);
  });

  /** GCM's whole point: an edited row must fail, not decrypt to something. */
  it("refuses a tampered ciphertext", () => {
    const sealed = seal("secret");
    const parts = sealed.split(":");
    const body = Buffer.from(parts[3] as string, "base64url");
    body[0] = (body[0] ?? 0) ^ 0xff;
    parts[3] = body.toString("base64url");

    expect(() => open(parts.join(":"))).toThrow(SealError);
  });

  it("refuses a value sealed with another key", () => {
    const sealed = seal("secret");
    h.env.EMAIL_TOKEN_KEY = OTHER_KEY;
    expect(() => open(sealed)).toThrow(SealError);
  });

  it("refuses a value that is not in the expected format", () => {
    expect(() => open("not-sealed")).toThrow(SealError);
    expect(() => open("v2:a:b:c")).toThrow(SealError);
  });

  /** Better to refuse the connect flow than to store a token in the clear. */
  it("refuses to seal without a key", () => {
    h.env.EMAIL_TOKEN_KEY = undefined;
    expect(sealingConfigured()).toBe(false);
    expect(() => seal("x")).toThrow(/EMAIL_TOKEN_KEY is not set/);
  });

  it("refuses a key of the wrong length", () => {
    h.env.EMAIL_TOKEN_KEY = Buffer.from("too short").toString("base64");
    expect(sealingConfigured()).toBe(false);
    expect(() => seal("x")).toThrow(/32 bytes/);
  });
});
