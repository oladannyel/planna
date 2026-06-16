import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const userResult: { value: { data: { user: unknown }; error: unknown } } = {
    value: { data: { user: null }, error: null },
  };
  const wsResult: { value: { data: unknown; error: unknown } } = {
    value: { data: null, error: null },
  };

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(wsResult.value),
  };

  const supabase = {
    auth: { getUser: () => Promise.resolve(userResult.value) },
    from: () => builder,
  };

  return { userResult, wsResult, supabase };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => h.supabase,
}));

const { getAuthedContext } = await import("../queries");

beforeEach(() => {
  h.userResult.value = { data: { user: { id: "user-1" } }, error: null };
  h.wsResult.value = { data: { id: "ws-1" }, error: null };
});

describe("getAuthedContext", () => {
  it("returns the supabase client, user id, and workspace id", async () => {
    const result = await getAuthedContext();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe("user-1");
      expect(result.value.workspaceId).toBe("ws-1");
    }
  });

  it("returns UNAUTHORIZED with no user", async () => {
    h.userResult.value = { data: { user: null }, error: null };
    const result = await getAuthedContext();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("returns DB_ERROR when the workspace lookup errors", async () => {
    h.wsResult.value = { data: null, error: { message: "boom" } };
    const result = await getAuthedContext();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("DB_ERROR");
  });

  it("returns NOT_FOUND when the user has no workspace", async () => {
    h.wsResult.value = { data: null, error: null };
    const result = await getAuthedContext();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});
