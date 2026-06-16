import { beforeEach, describe, expect, it, vi } from "vitest";

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface MockUser {
  id: string;
  email: string | null;
}

const h = vi.hoisted(() => {
  const state: {
    user: MockUser | null;
    selectResult: QueryResult;
    insertResults: QueryResult[];
  } = {
    user: null,
    selectResult: { data: null, error: null },
    insertResults: [],
  };
  return { state, insertSpy: vi.fn() };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: h.state.user }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(h.state.selectResult),
        }),
      }),
      insert: (payload: unknown) => {
        h.insertSpy(payload);
        return {
          select: () => ({
            single: () =>
              Promise.resolve(h.state.insertResults.shift() ?? { data: null, error: null }),
          }),
        };
      },
    }),
  }),
}));

const { ensureWorkspace } = await import("../actions");

describe("ensureWorkspace", () => {
  beforeEach(() => {
    h.state.user = { id: "user-1", email: "dan@planna.com" };
    h.state.selectResult = { data: null, error: null };
    h.state.insertResults = [];
    h.insertSpy.mockReset();
  });

  it("returns UNAUTHORIZED when there is no session", async () => {
    h.state.user = null;
    const result = await ensureWorkspace();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
    expect(h.insertSpy).not.toHaveBeenCalled();
  });

  it("returns the existing workspace without inserting", async () => {
    h.state.selectResult = { data: { id: "ws-1", slug: "dan-abc123" }, error: null };
    const result = await ensureWorkspace();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ id: "ws-1", slug: "dan-abc123" });
    expect(h.insertSpy).not.toHaveBeenCalled();
  });

  it("creates a workspace with a generated slug on first login", async () => {
    h.state.insertResults = [{ data: { id: "ws-9", slug: "dan-xyz" }, error: null }];
    const result = await ensureWorkspace();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe("ws-9");

    expect(h.insertSpy).toHaveBeenCalledTimes(1);
    const payload = h.insertSpy.mock.calls[0]?.[0] as {
      owner_id: string;
      name: string;
      slug: string;
    };
    expect(payload.owner_id).toBe("user-1");
    expect(payload.name).toBe("dan's workspace");
    expect(payload.slug).toMatch(/^dan-[a-z0-9]{6}$/);
  });

  it("retries on a unique-slug violation then succeeds", async () => {
    h.state.insertResults = [
      { data: null, error: { code: "23505", message: "duplicate key" } },
      { data: { id: "ws-2", slug: "dan-second" }, error: null },
    ];
    const result = await ensureWorkspace();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.slug).toBe("dan-second");
    expect(h.insertSpy).toHaveBeenCalledTimes(2);
  });

  it("gives up with DB_ERROR after exhausting slug attempts", async () => {
    h.state.insertResults = Array.from({ length: 5 }, () => ({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    }));
    const result = await ensureWorkspace();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DB_ERROR");
      expect(result.error.message).toMatch(/unique workspace slug/);
    }
    expect(h.insertSpy).toHaveBeenCalledTimes(5);
  });

  it("returns DB_ERROR on a non-unique insert failure", async () => {
    h.state.insertResults = [{ data: null, error: { code: "42P01", message: "no table" } }];
    const result = await ensureWorkspace();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });

  it("returns DB_ERROR when the lookup query fails", async () => {
    h.state.selectResult = { data: null, error: { code: "500", message: "boom" } };
    const result = await ensureWorkspace();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
    expect(h.insertSpy).not.toHaveBeenCalled();
  });

  it("falls back to a default base when the user has no email", async () => {
    h.state.user = { id: "user-2", email: null };
    h.state.insertResults = [{ data: { id: "ws-3", slug: "workspace-abc123" }, error: null }];
    const result = await ensureWorkspace();
    expect(result.ok).toBe(true);
    const payload = h.insertSpy.mock.calls[0]?.[0] as { name: string; slug: string };
    expect(payload.name).toBe("workspace's workspace");
    expect(payload.slug).toMatch(/^workspace-[a-z0-9]{6}$/);
  });
});
