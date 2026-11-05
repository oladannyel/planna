/**
 * Columns selected for a `Task`.
 *
 * Named explicitly rather than `select("*")`. This saves nothing today —
 * `rowToTask` consumes every column the table currently has — but it means a
 * column added later (a long notes field, an embedding, a blob) cannot
 * silently enter every list query in the app. The cost of `*` is paid in the
 * future, not the present.
 *
 * It must stay one unbroken string literal. Supabase infers the row type from
 * that literal, and anything computed — a `.join()`, or even `"a" + "b"` —
 * widens to `string` and collapses the result type to `GenericStringError`.
 * Hence the long line and the eslint exception.
 *
 * Keep in step with `rowToTask` in `mappers.ts`.
 */
// prettier-ignore
export const TASK_COLUMNS = "id, workspace_id, title, description, status, priority, tags, due_date, due_at, estimated_minutes, source, requested_by, carried_over, carry_count, status_history, completed_at, created_at, updated_at";
