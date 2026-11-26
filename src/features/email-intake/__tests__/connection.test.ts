import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const connection: { value: Record<string, unknown> | null } = { value: null };
  const readError: { value: unknown } = { value: null };
  const upserts: { arg: Record<string, unknown>; options: unknown }[] = [];
  const upsertError: { value: unknown } = { value: null };
  const updates: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  const stored: { value: string | null } = { value: null };
  const revokeResult: { value: unknown } = { value: { ok: true, value: null } };
  const selectedColumns: string[] = [];
  const authed: { value: unknown } = { value: null };

  function builder(client: "admin" | "server"): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    Object.assign(self, {
      select: (columns: string) => {
        selectedColumns.push(columns);
        return self;
      },
      eq: () => self,
      maybeSingle: () =>
        Promise.resolve(
          readError.value
            ? { data: null, error: readError.value }
            : {
                data:
                  client === "admin"
                    ? stored.value
                      ? { refresh_token: stored.value }
                      : null
                    : connection.value,
                error: null,
              },
        ),
      upsert: (arg: Record<string, unknown>, options: unknown) => {
        upserts.push({ arg, options });
        return self;
      },
      update: (arg: Record<string, unknown>) => {
        updates.push(arg);
        return self;
      },
      delete: () => {
        deletes.push("email_connections");
        return self;
      },
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: null, error: upsertError.value }),
    });
    return self;
  }

  return {
    connection,
    readError,
    upserts,
    upsertError,
    updates,
    deletes,
    stored,
    revokeResult,
    selectedColumns,
    authed,
    admin: { from: () => builder("admin") },
    supabase: { from: () => builder("server") },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/sealed", () => ({
  seal: (value: string) => `sealed(${value})`,
  open: (value: string) => value.replace(/^sealed\(|\)$/g, ""),
}));
vi.mock("../oauth", () => ({ revokeToken: () => Promise.resolve(h.revokeResult.value) }));
vi.mock("@/features/workspace/queries", () => ({
  getAuthedContext: () =>
    Promise.resolve(
      h.authed.value ?? {
        ok: true,
        value: {
          supabase: h.supabase,
          userId: "owner-1",
          workspaceId: "ws-1",
          workspaceSlug: "demo",
        },
      },
    ),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { getEmailConnection, storeConnection } = await import("../connection");
const { disconnectEmail, updateEmailQuery } = await import("../actions");

beforeEach(() => {
  h.connection.value = null;
  h.readError.value = null;
  h.upserts.length = 0;
  h.upsertError.value = null;
  h.updates.length = 0;
  h.deletes.length = 0;
  h.selectedColumns.length = 0;
  h.stored.value = null;
  h.revokeResult.value = { ok: true, value: null };
  h.authed.value = null;
});

describe("getEmailConnection", () => {
  it("returns null when no mailbox is connected", async () => {
    const result = await getEmailConnection();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  /**
   * RLS is row-level, so the owner's own policy would happily hand back the
   * sealed token. Not naming the column is what keeps it off the page.
   */
  it("never selects the refresh token", async () => {
    await getEmailConnection();
    expect(h.selectedColumns.join(" ")).not.toContain("refresh_token");
  });

  it("maps the row to the view the settings page uses", async () => {
    h.connection.value = {
      email_address: "me@example.com",
      query: "label:plAnna",
      state: "active",
      last_error: null,
      last_polled_at: "2026-11-26T09:00:00.000Z",
      last_task_at: null,
    };

    const result = await getEmailConnection();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        emailAddress: "me@example.com",
        query: "label:plAnna",
        state: "active",
        lastError: null,
        lastPolledAt: "2026-11-26T09:00:00.000Z",
        lastTaskAt: null,
      });
    }
  });

  it("surfaces a read failure", async () => {
    h.readError.value = { message: "boom" };
    const result = await getEmailConnection();
    expect(result.ok).toBe(false);
  });
});

describe("storeConnection", () => {
  it("seals the refresh token and replaces any existing grant", async () => {
    const result = await storeConnection({
      workspaceId: "ws-1",
      emailAddress: "me@example.com",
      refreshToken: "rt-live",
    });

    expect(result.ok).toBe(true);
    expect(h.upserts[0]?.arg).toMatchObject({
      workspace_id: "ws-1",
      refresh_token: "sealed(rt-live)",
      state: "active",
    });
    expect(h.upserts[0]?.options).toEqual({ onConflict: "workspace_id" });
  });

  it("reports a write failure", async () => {
    h.upsertError.value = { message: "boom" };
    const result = await storeConnection({
      workspaceId: "ws-1",
      emailAddress: "me@example.com",
      refreshToken: "rt",
    });
    expect(result.ok).toBe(false);
  });
});

describe("disconnectEmail", () => {
  it("revokes at Google and deletes the row", async () => {
    h.stored.value = "sealed(rt-live)";

    const result = await disconnectEmail();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.revoked).toBe(true);
    expect(h.deletes).toHaveLength(1);
  });

  /** We must not keep a token the owner asked us to drop. */
  it("still deletes the row when Google refuses the revoke", async () => {
    h.stored.value = "sealed(rt-live)";
    h.revokeResult.value = { ok: false, error: { code: "DB_ERROR", message: "nope" } };

    const result = await disconnectEmail();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.revoked).toBe(false);
    expect(h.deletes).toHaveLength(1);
  });

  it("deletes the row when there is no token to revoke", async () => {
    h.stored.value = null;

    const result = await disconnectEmail();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.revoked).toBe(false);
    expect(h.deletes).toHaveLength(1);
  });

  it("refuses an unauthenticated caller", async () => {
    h.authed.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await disconnectEmail();
    expect(result.ok).toBe(false);
    expect(h.deletes).toHaveLength(0);
  });
});

describe("updateEmailQuery", () => {
  it("saves a trimmed search", async () => {
    const result = await updateEmailQuery("  label:plAnna is:unread  ");
    expect(result.ok).toBe(true);
    expect(h.updates[0]).toEqual({ query: "label:plAnna is:unread" });
  });

  /** An empty search matches the whole mailbox. */
  it("refuses an empty or oversized search", async () => {
    for (const bad of ["", "   ", "x".repeat(201)]) {
      const result = await updateEmailQuery(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(h.updates).toHaveLength(0);
  });

  it("refuses an unauthenticated caller", async () => {
    h.authed.value = { ok: false, error: { code: "UNAUTHORIZED", message: "no" } };
    const result = await updateEmailQuery("label:plAnna");
    expect(result.ok).toBe(false);
  });
});
