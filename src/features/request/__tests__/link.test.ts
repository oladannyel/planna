import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve({ get: h.get }),
}));

const ORIGINAL_ENV = process.env;

function withHeaders(values: Record<string, string | null>): void {
  h.get.mockImplementation((name: string) => values[name.toLowerCase()] ?? null);
}

beforeEach(() => {
  vi.resetModules();
  h.get.mockReset();
  process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_APP_URL: "https://configured.example.com/" };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("requestLinkFor", () => {
  it("builds the public path from an origin and a slug", async () => {
    const { requestLinkFor } = await import("../link");
    expect(requestLinkFor("https://planna.example", "daniel-a1b2")).toBe(
      "https://planna.example/request/daniel-a1b2",
    );
  });

  it("does not produce a double slash when the origin has a trailing one", async () => {
    const { requestLinkFor } = await import("../link");
    expect(requestLinkFor("https://planna.example/", "daniel-a1b2")).toBe(
      "https://planna.example/request/daniel-a1b2",
    );
  });
});

describe("publicOrigin", () => {
  it("uses the host the browser actually asked for", async () => {
    withHeaders({ host: "planna-puce.vercel.app" });
    const { publicOrigin } = await import("../link");
    await expect(publicOrigin()).resolves.toBe("https://planna-puce.vercel.app");
  });

  it("prefers the forwarded host behind a proxy", async () => {
    withHeaders({ host: "internal.vercel.app", "x-forwarded-host": "tasks.example.com" });
    const { publicOrigin } = await import("../link");
    await expect(publicOrigin()).resolves.toBe("https://tasks.example.com");
  });

  it("honours a forwarded protocol", async () => {
    withHeaders({ host: "tasks.example.com", "x-forwarded-proto": "http" });
    const { publicOrigin } = await import("../link");
    await expect(publicOrigin()).resolves.toBe("http://tasks.example.com");
  });

  it("takes the first entry when the proxy chain lists several protocols", async () => {
    withHeaders({ host: "tasks.example.com", "x-forwarded-proto": "https,http" });
    const { publicOrigin } = await import("../link");
    await expect(publicOrigin()).resolves.toBe("https://tasks.example.com");
  });

  it("uses http for localhost, so a dev link is clickable", async () => {
    // https://localhost:3000 does not serve, and a link nobody can open is
    // the whole failure this feature exists to avoid.
    withHeaders({ host: "localhost:3000" });
    const { publicOrigin } = await import("../link");
    await expect(publicOrigin()).resolves.toBe("http://localhost:3000");
  });

  it("uses http for the loopback address too", async () => {
    withHeaders({ host: "127.0.0.1:3000" });
    const { publicOrigin } = await import("../link");
    await expect(publicOrigin()).resolves.toBe("http://127.0.0.1:3000");
  });

  it("does not mistake a hostname that merely starts with localhost", async () => {
    withHeaders({ host: "localhost.attacker.example" });
    const { publicOrigin } = await import("../link");
    await expect(publicOrigin()).resolves.toBe("https://localhost.attacker.example");
  });

  it("falls back to the configured URL when there is no host header", async () => {
    withHeaders({});
    const { publicOrigin } = await import("../link");
    await expect(publicOrigin()).resolves.toBe("https://configured.example.com");
  });
});
