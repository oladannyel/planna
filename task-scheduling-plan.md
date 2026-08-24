# plAnna — Task Editing, Deadlines & Honest Scheduling Metrics

**Goal:** Make tasks clickable & editable, allow setting a real deadline (date **and** time),
default every new task to a **24-hour deadline** (editable), and stop the on-time metric from
counting un-scheduled tasks as "late".

This plan was generated and executed by Claude Code. Status markers updated as work lands.

---

## Background (why)

- The backend already has `updateTask` / `deleteTask` server actions — but **nothing in the UI
  calls them**. `TaskCard` is a pure display component (no click, no detail view).
- `QuickAdd` (the only create path) sends `{title, priority, tags}` for manual tasks — no way to
  set a due date or estimate.
- `due_date` was a date-only column; the weekly report wanted time-blocking ("@ 9am Tue"), which
  the model couldn't represent.
- `onTimeRate` divided on-time tasks by **all** completed tasks, so every date-less task counted
  as "late" → the misleading "3% on-time" figure. With no UI to set dates, ~all tasks were date-less.

## Data model change

Add a precise `due_at timestamptz` while keeping the existing date-only `due_date` (used for
calendar / weekly grouping & range queries) **derived from** `due_at`. `due_at` becomes the source
of truth for the deadline and the on-time metric.

---

## Phases

### Phase 1 — Schema & data (`due_at` + 24h default)

- [x] Migration `0005_due_at.sql`: add `due_at timestamptz`, backfill from `due_date` (end of day),
      index `(workspace_id, due_at)`. Append to `all_migrations.sql`.
- [x] `src/types/database.ts`: add `due_at` to Row/Insert/Update.
- [x] `types.ts`: `Task.dueAt: string | null`; `TaskInput.dueAt?: string`.
- [x] `schema.ts`: `dueAt: z.string().datetime().optional()`.
- [x] `mappers.ts`: map `due_at` → `dueAt`.

### Phase 2 — Create with a default 24h deadline

- [x] `actions.ts` `createTask`: if no `dueAt`/`dueDate` given → default `dueAt = now + 24h`;
      always derive `due_date` from `due_at`. `updateTask`: when `dueAt` provided, set `due_at`
      and re-derive `due_date` (keep legacy `dueDate`-only patches unchanged).
- [x] `QuickAdd.tsx`: optional collapsible "deadline + estimate" row.

### Phase 3 — Click into a task & edit it

- [x] `TaskDetailSheet.tsx`: slide-over to edit title/description/priority/status/tags/deadline
      (`datetime-local`)/estimate; Save → `updateTask`, Delete → `deleteTask`, then `router.refresh()`.
- [x] `TaskSheetProvider.tsx`: client context exposing `open(task)`, renders the sheet.
- [x] `TaskCard.tsx`: become a clickable button that calls `open(task)`; show `dueAt` (date+time).
- [x] Wrap the daily / board / weekly / monthly views in the provider.

### Phase 4 — Honest metrics

- [x] `metrics.ts`: `isOnTime` uses `dueAt` (fallback `dueDate` EOD); `onTimeRate` denominator =
      completed tasks **that had a deadline**; add `scheduledRate` (tasks with a deadline / total).
- [x] `OnTimeRateCard.tsx` + analytics page: surface `scheduledRate`.

### Verification

- [x] `npm run typecheck` (also flushes out every test factory needing `dueAt`)
- [x] `npm run lint` (zero warnings)
- [x] `npm test` (update affected factories + on-time tests; add sheet test)
- [x] Dev server compiles; manual click→edit→save smoke check.

## Deploy note

The migration must be applied to the live Supabase project (`supabase db push` or run
`0005_due_at.sql`). Type/lint/test gates do **not** require a live DB (Supabase is mocked in tests).
