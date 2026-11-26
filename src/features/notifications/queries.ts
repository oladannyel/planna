import { getAuthedContext } from "@/features/workspace/queries";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

export interface BellNotification {
  id: string;
  kind: "request_received";
  title: string;
  body: string | null;
  requestId: string | null;
  readAt: string | null;
  createdAt: string;
}

const NOTIFICATION_COLUMNS = "id, kind, title, body, request_id, read_at, created_at";

/** The newest bell items for this workspace. */
export async function listNotifications(limit = 20): Promise<Result<BellNotification[]>> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.value.supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("workspace_id", ctx.value.workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return err({ code: "DB_ERROR", message: error.message });

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      requestId: row.request_id,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
  );
}

/** Unread count for the badge. Returns 0 rather than failing the layout. */
export async function unreadNotificationCount(): Promise<number> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) return 0;

  const { count, error } = await ctx.value.supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.value.workspaceId)
    .is("read_at", null);

  return error ? 0 : (count ?? 0);
}
