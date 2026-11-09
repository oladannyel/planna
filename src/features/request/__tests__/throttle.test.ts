import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key" },
}));

const { addressKey, claimSlot, clientAddress } = await import("../throttle");

describe("clientAddress", () => {
  it("prefers x-real-ip, which the platform sets and the client cannot", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.4",
      "x-forwarded-for": "1.2.3.4, 198.51.100.4",
    });
    expect(clientAddress(headers)).toBe("198.51.100.4");
  });

  it("falls back to the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 70.41.3.18" });
    expect(clientAddress(headers)).toBe("203.0.113.9");
  });

  it("returns null when neither header is present", () => {
    expect(clientAddress(new Headers())).toBeNull();
  });

  it("returns null for a header that is present but empty", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "   " }))).toBeNull();
  });
});

describe("addressKey", () => {
  it("is stable for the same address", () => {
    expect(addressKey("198.51.100.4")).toBe(addressKey("198.51.100.4"));
  });

  it("differs between addresses", () => {
    expect(addressKey("198.51.100.4")).not.toBe(addressKey("198.51.100.5"));
  });

  it("does not contain the address it was derived from", () => {
    expect(addressKey("198.51.100.4")).not.toContain("198");
  });

  it("normalises case and surrounding space, so one caller is one bucket", () => {
    expect(addressKey(" 2001:DB8::1 ")).toBe(addressKey("2001:db8::1"));
  });
});

describe("claimSlot", () => {
  function adminWith(response: { data: unknown; error: unknown }) {
    const rpc = vi.fn(() => Promise.resolve(response));
    // The real client is far wider than this; claimSlot only ever calls .rpc.
    return { admin: { rpc } as never, rpc };
  }

  it("allows a claim the function accepted", async () => {
    const { admin } = adminWith({ data: true, error: null });
    const result = await claimSlot(admin, "ip:abc", 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.allowed).toBe(true);
  });

  it("refuses a claim the function rejected", async () => {
    const { admin } = adminWith({ data: false, error: null });
    const result = await claimSlot(admin, "ip:abc", 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.allowed).toBe(false);
  });

  it("passes the bucket and limit through to the function", async () => {
    const { admin, rpc } = adminWith({ data: true, error: null });
    await claimSlot(admin, "ws:ws-1", 20);
    expect(rpc).toHaveBeenCalledWith("claim_request_slot", {
      p_bucket: "ws:ws-1",
      p_limit: 20,
    });
  });

  /** A deployment that has not applied migration 0007 must not run uncapped. */
  it("fails closed when the function is missing", async () => {
    const { admin } = adminWith({
      data: null,
      error: { message: "function claim_request_slot does not exist" },
    });
    const result = await claimSlot(admin, "ip:abc", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DB_ERROR");
      expect(result.error.message).toContain("Throttle check failed");
    }
  });

  it("treats a null answer as a refusal, not as permission", async () => {
    const { admin } = adminWith({ data: null, error: null });
    const result = await claimSlot(admin, "ip:abc", 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.allowed).toBe(false);
  });
});
