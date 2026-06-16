# plAnna — Phase 3 Build Plan: Insight

> **Goal**: Turn captured/executed task data into insight — an analytics dashboard, a monthly calendar with stats, and AI-generated weekly + monthly narratives (persisted).
> **Source of truth**: `PLANNA_BUILD_SPEC.md` (§5 tables, §7 `generateMonthlySummary`, §9 monthly view, §10 yearly stub, §11 UI).
> **Builds on**: Phase 1 foundation + Phase 2 task system (see `phase2.md`). Reuses `Result`, typed Supabase client, `getAuthedContext`, lazy `getOpenRouter()`, `getTasksInRange`, `toISODate`/`getMonthRange`, `computeCurrentStreak`.

---

## How to use this document

Work the tasks **top to bottom**. A task is **not done** until its **Engineering Standard Gate** passes. Check the boxes as you go. Do not start task N+1 until task N's gate is green.

### Engineering Standard Gate (applies to EVERY task)

```bash
pnpm typecheck   # tsc --noEmit — exit 0
pnpm lint        # eslint . --max-warnings 0 — exit 0
pnpm test        # vitest run --coverage — exit 0, thresholds met (≥90 line/stmt/func, ≥85 branch on touched modules)
pnpm build       # next build — exit 0
```

Plus the non-negotiables (spec §0 / §15): no `any`; no unchecked `as` (use guards / narrowing filters); every server action returns `Result<T, AppError>`; every server action + utility has a unit test; new table access covered by an RLS policy (the owner policies in `0002` already cover `weekly_reports`, `monthly_summaries`, `daily_logs`); works at 375px; conventional commit per task.

### Conventions carried from Phase 2 (reuse, don't reinvent)

- **Pure logic first.** Put every metric/aggregation/calendar computation in a pure, 100%-covered module (`metrics.ts`, `calendar.ts`). Keep components and actions thin wrappers. Recharts/SVG chart components and dnd-style view glue go in `vitest.config.ts` `coverage.exclude` **with a justification comment** — their inputs come from tested pure functions.
- **Test actions** by mocking `getAuthedContext`, `getOpenRouter`, and `next/cache` with the `vi.hoisted` chainable-builder pattern (see `features/tasks/__tests__/actions.test.ts`).
- **AI client is lazy** — call `getOpenRouter()` at use-time; never at import (throws in jsdom). Use `env.OPENROUTER_REPORT_MODEL` for narratives.
- **`exactOptionalPropertyTypes` is on** — omit optional keys via `...(cond ? { key } : {})`, never pass `undefined`.
- **Persisted JSON** (`stats`, `top_categories`, `ethics_answers`) is typed as `Json`; build values as fresh literals or via a small `toJson` helper to satisfy the index-signature constraint.
- **Deep-linkable views** use a URL param (`?month=YYYY-MM`) resolved by a pure function with a safe fallback, mirroring weekly's `resolveWeekStart`.

---

## Task 0 — Insight metrics core (pure aggregations)

**Why first**: analytics, monthly stats, and the AI summaries all consume the same numbers. Compute them once, test to 100%.

**Files**

- `src/features/analytics/metrics.ts` — pure functions over `Task[]`:
  - `completionRate(tasks)`, `onTimeRate(tasks)` (done before `dueDate` end-of-day), `carryoverRate(tasks)`.
  - `avgCycleTimeHours(tasks)` — mean `createdAt → completedAt` for done tasks.
  - `tasksPerDay(tasks, range)` — `{ date, created, completed }[]` across an inclusive ISO range.
  - `categoryBreakdown(tasks)` — `{ tag, count }[]` desc (top-N helper).
  - `bestStreak(tasks)` — longest run of consecutive days with ≥1 completion.
  - `monthlyStats(tasks)` — the `MonthlySummaryResult["stats"]` shape (totals, rates, `topTags`) reused by Task 3.
- `src/features/analytics/__tests__/metrics.test.ts`

**Acceptance**

- [x] Each function pure + deterministic (caller supplies day ranges); empty-input and divide-by-zero paths return zeros (`metrics.ts`, 100% covered).
- [x] **Engineering Standard Gate green.** _(also hardened `vitest.config.ts` app-dir coverage exclusion against route-group dirs)_

---

## Task 1 — Analytics dashboard (Recharts)

**Depends on**: Task 0; Phase 2 `getTasks`.

**Files**

- `src/features/analytics/queries.ts` — `getAnalyticsTasks()` (workspace-scoped fetch via `getAuthedContext`, returns `Result<Task[]>`), or reuse `getTasks`.
- Chart components (client, Recharts in `ResponsiveContainer`): `TasksPerDayChart.tsx`, `CycleTimeChart.tsx`, `CategoryBreakdown.tsx`, `OnTimeRateCard.tsx`; `index.ts`.
- `src/app/(dashboard)/analytics/page.tsx` — Server Component fetches tasks, computes metrics (Task 0), passes plain data to chart components. Skeleton via segment `loading.tsx`; `<EmptyState>` when no data.
- Tests: `OnTimeRateCard` (pure stat card) rendered + asserted. SVG chart components → `coverage.exclude` with comment (their data is computed by the tested `metrics.ts`; Recharts renders to SVG that jsdom can't meaningfully assert).

**Acceptance**

- [x] Four views fed by `metrics.ts`: `TasksPerDayChart`, `CycleTimeChart`, `CategoryBreakdown` (Recharts), `OnTimeRateCard` (stat card, tested); palette per §11; `ResponsiveContainer` + `md:grid-cols-2` for 375px.
- [x] Replaces the Phase 2 placeholder `analytics/page.tsx`; empty state when no tasks.
- [x] **Engineering Standard Gate green.** _(reused `getTasks`; added `cycleTimes` metric; Recharts SVG charts coverage-excluded with justification)_

---

## Task 2 — Monthly calendar + stats (pure + presentational)

**Depends on**: Task 0; Phase 1 `getMonthRange`; Phase 2 `getTasksInRange`.

**Files**

- `src/features/monthly/calendar.ts` — pure: `resolveMonth(param?, today) → { year, month }`; `monthGrid(year, month) → weeks[][]` of `{ date, inMonth }`; `dayDots(tasks) → Record<date, "done" | "in_progress" | "overdue">` (green/amber/red per §9); `shiftMonth(year, month, delta)`.
- `src/features/monthly/MonthlyStats.tsx` — stat cards row: created, completion %, carryover %, on-time %, best streak (all from `metrics.ts`).
- `src/features/monthly/MonthlyCalendar.tsx` — 7-col grid, date number + coloured task dots; clicking a day opens a side panel listing that day's tasks (client for panel state).
- `src/app/(dashboard)/monthly/page.tsx` — `?month=YYYY-MM` deep-link + `<`/`>` nav; fetch month range, render stats + calendar.
- Tests: `calendar.test.ts` (grid shape 4–6 weeks, leading/trailing days flagged `inMonth:false`, dot precedence overdue>in_progress>done, month nav, param fallback); `MonthlyStats` render.

**Acceptance**

- [x] Grid covers the full month (Mon→Sun) with correct leading/trailing `inMonth:false` days; dots green/amber/red per §9; `?month=YYYY-MM` deep-link + nav; day-click panel lists that day's tasks (`calendar.ts` 100% lines/91% branch).
- [x] Replaces the Phase 2 placeholder `monthly/page.tsx`.
- [x] **Engineering Standard Gate green.**

---

## Task 3 — Monthly AI summary: generation + storage

**Depends on**: Task 0, Task 2.

**Files**

- `src/features/monthly/actions.ts` — `"use server"`:
  - `generateMonthlySummary(year, month): Promise<Result<MonthlySummaryResult>>` (spec §7) — `getAuthedContext`, fetch month tasks, compute `monthlyStats` (Task 0). **If zero tasks → return early, no AI call, no DB write** (decision 1). Otherwise build prompt, call `getOpenRouter()` with `OPENROUTER_REPORT_MODEL`, **upsert** `monthly_summaries` (unique `workspace_id, year, month`), `revalidatePath`. Regeneration is allowed (upsert overwrites — decision 2).
  - Persist `stats` + `top_categories` as `Json`.
- `src/features/monthly/queries.ts` — `getMonthlySummary(year, month): Promise<Result<MonthlySummary | null>>`.
- `src/features/monthly/MonthlySummary.tsx` — shows narrative if present with a **"Regenerate"** control; otherwise a "Generate summary" button; calls the action via `useTransition`/`void`; loading skeleton (§9); `<EmptyState>` when the month has no tasks.
- Tests: `actions.test.ts` — unauthorized, no-workspace, db-error, empty-month (no AI call, no upsert), AI-error (typed error, no crash), success persists + returns, regenerate overwrites; mock `getAuthedContext`/`getOpenRouter`/`next/cache`. Component test for the states (empty / no summary / generating / generated+regenerate).

**Acceptance**

- [x] Empty month → `VALIDATION_ERROR` (no AI, no upsert) and the component shows `<EmptyState>`; non-empty generates + upserts (`onConflict` on the unique key); "Regenerate" overwrites; AI throw → `AI_ERROR` without persisting.
- [x] **Engineering Standard Gate green.** _(`statsToJson`/`topTagsToJson` keep persisted JSON typed without `as`)_

---

## Task 4 — Weekly + monthly reports: generation + storage

**Depends on**: Task 0, Task 3.

**Files**

- `src/features/reports/actions.ts` — `"use server"`:
  - `generateWeeklyReport(weekStart): Promise<Result<WeeklyReportResult>>` — week stats (Task 0); **empty week → early return, no AI/DB** (decision 1); else AI narrative (`OPENROUTER_REPORT_MODEL`), **upsert** `weekly_reports` (unique `workspace_id, week_start`), regeneration allowed (decision 2); `ethics_answers` left null until Phase 4.
  - `generateMonthlyReport(year, month)` — reuse/wrap `generateMonthlySummary` for the report surface.
  - `generateYearlySummary(year): Promise<Result<never>>` — **stub** returning `err({ code: "NOT_FOUND", message: "Yearly summary not yet implemented" })` (spec §10).
- `src/features/reports/queries.ts` — `getWeeklyReport(weekStart)`, `getMonthlyReport(year, month)`.
- `src/features/reports/WeeklyReport.tsx`, `MonthlyReport.tsx` — narrative display + generate/regenerate controls.
- `src/app/(dashboard)/reports/page.tsx` — week + month report surfaces; replaces the Phase 2 placeholder.
- Tests: `actions.test.ts` (weekly happy/err paths, yearly stub returns NOT_FOUND); component render tests.

**Acceptance**

- [x] Weekly report persists + is idempotent per `week_start` (upsert, skips empty weeks); `generateMonthlyReport` delegates to the monthly summary; `generateYearlySummary` is a typed `NOT_FOUND` stub; reports page renders both surfaces.
- [x] **Engineering Standard Gate green.** _(yearly stub keeps `async` for the "use server" contract with a scoped `require-await` disable)_

---

## Task 5 — Daily snapshot writer (DEFERRED — decision 3)

> **Deferred this phase.** Analytics computes live from tasks (accurate for Phase 3), so the `daily_logs` writer is not built now. This section is kept as the spec for when historical day-by-day trends are needed. Skip straight to Task 6.

**Depends on**: Task 0. `daily_logs` is an optimization + history source, not required by Phase 3's charts.

**Files**

- `src/features/analytics/snapshot.ts` — pure `buildDailyLog(tasks, date) → daily_logs insert row` (completed/created/carried/on-time counts for the date).
- `src/app/api/cron/daily-log/route.ts` — service-role route that upserts the snapshot for "yesterday" across workspaces; guarded by a `CRON_SECRET` header (add to `env.ts`).
- Tests: `snapshot.test.ts` (counts); route contract test (401 without secret, 200 with). Route → `coverage.exclude` (thin delegation) if needed.

**Acceptance**

- [ ] If built: snapshot counts correct; route rejects unauthenticated cron calls. If deferred: `log()`/note it and confirm analytics still reads live task data.
- [ ] **Engineering Standard Gate green.**

> Scheduling itself (Vercel Cron / Supabase `pg_cron`) is infra config, not code — document the cron entry; do not block the gate on a live scheduler.

---

## Task 6 — Insight closeout

**Depends on**: all above.

**Checklist**

- [x] `analytics`, `monthly`, `reports` pages are real (grep confirms no "Coming in Phase 3" left); `ethics` stays a Phase 4 placeholder.
- [x] Insight views use responsive classes (analytics `md:grid-cols-2` + `ResponsiveContainer`; monthly stat cards `grid-cols-2 … lg:grid-cols-5`; reports stack); `<EmptyState>` for empty data; AI generation shows skeletons. _(375px verified by class review — live check in a `/run` pass.)_
- [x] No new env vars — Task 5 (CRON_SECRET) deferred per decision 3.
- [x] Full suite green (258 tests); coverage thresholds met; every coverage exclusion carries a justification comment.
- [x] **Final Engineering Standard Gate green.**

---

## Phase 3 Definition of Done (mirrors spec §12)

- [x] Analytics dashboard (4 views: 3 Recharts + on-time card)
- [x] Weekly report generation + storage
- [x] Monthly view: calendar + stats + AI summary
- [x] Monthly summary generation + storage
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all exit 0 (258 tests)

> Checkboxes are unchecked until each task's gate actually passes during the build.

---

## Decisions (confirmed)

1. **AI summary on empty data** → **Skip the AI call, render `<EmptyState>`, persist no row.** When a period has zero tasks, `generate*` returns early with a typed result and no model call / no DB write.
2. **Regeneration** → **Allowed.** Stats drift as tasks change, so the control reads "Regenerate" when a row exists; the action upserts (overwrites). This intentionally relaxes the spec's "only generates once".
3. **Daily snapshot (Task 5)** → **Deferred.** Analytics computes live from tasks (accurate for Phase 3). Task 5 is skipped this phase; revisit when historical day-by-day trends are needed. `daily_logs` table stays in place, unused for now.
