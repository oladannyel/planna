# plAnna — Phase 2 Build Plan: Capture + Execute

> **Goal**: Turn the Phase 1 foundation into a working task system — capture (manual + AI + request link), organize (Kanban), and execute (daily/weekly views).
> **Source of truth**: `PLANNA_BUILD_SPEC.md` (§2 structure, §6 types, §7 actions, §8 carryover, §11 UI).
> **Inherited conventions** (Phase 1): Next 14 App Router, `Result<T, AppError>` everywhere, typed Supabase client (`Database`), Zod validation, structured `logger`, Vitest 3 + jsdom 25, `@testing-library/jest-dom/vitest`, ESLint `recommended-type-checked` (test files relax only the `no-unsafe-*` family).

---

## How to use this document

Work the tasks **top to bottom**. Each task is **not done** until its **Engineering Standard Gate** passes. Check the boxes as you go. Do not start task N+1 until task N's gate is green.

### Engineering Standard Gate (applies to EVERY task)

```bash
pnpm typecheck   # tsc --noEmit — exit 0
pnpm lint        # eslint . --max-warnings 0 — exit 0
pnpm test        # vitest run --coverage — exit 0, thresholds met
pnpm build       # next build — exit 0
```

Plus the non-negotiables from spec §0 / §15:

- No `any`. No `as` without a preceding runtime check.
- Every server action returns `Result<T, AppError>` — no raw throws across the boundary.
- Every server action and every utility function has a unit test.
- ≥ 90% line/statement/function coverage, ≥ 85% branch on touched modules.
- Every new Supabase table access is covered by an RLS policy (already in `0002`).
- Works at 375px width.
- Conventional commit per task: `type(scope): description`.

> **Coverage policy**: pure logic and server actions are unit-tested to threshold. Thin framework glue (route handlers that only delegate, realtime subscription wiring) may be added to `vitest.config.ts` coverage `exclude` with a one-line justification comment — same rule Phase 1 used for the Supabase clients.

---

## Task 0 — Phase 2 scaffolding & shared task domain types

**Why first**: every later task imports these. No UI yet.

**Files**

- `src/features/tasks/types.ts` — `Task`, `TaskStatus`, `TaskPriority`, `TaskSource`, `StatusHistoryEntry`, `TaskInput`, `ParsedTaskResult` (spec §6).
- `src/features/tasks/schema.ts` — `taskInputSchema`, `requestInputSchema` (spec §6). Use Zod 4.
- `src/features/tasks/mappers.ts` — `rowToTask(row: Database row) → Task` (snake_case → camelCase, parse `status_history` JSON safely). This isolates the DB↔domain boundary so no `as` casts leak into actions.
- `src/features/tasks/index.ts` — barrel.
- `src/features/tasks/__tests__/mappers.test.ts`

**Acceptance**

- [x] All Phase 1 type/lint rules satisfied; `rowToTask` has a runtime-checked parse of `status_history` (no blind `as`).
- [x] `mappers.test.ts` covers a full row, null-field row, and malformed `status_history` fallback.
- [x] **Engineering Standard Gate green.** _(also added `schema.test.ts`; excluded `.next/`+`coverage/` from coverage — build artifacts must not be measured)_

---

## Task 1 — Task CRUD server actions + queries

**Depends on**: Task 0.

**Files**

- `src/features/tasks/queries.ts` — read helpers used by Server Components: `getTasks(workspaceId)`, `getTaskById`, `getTasksInRange(workspaceId, start, end)`. All return `Result<…>`.
- `src/features/tasks/actions.ts` — `"use server"`: `createTask`, `updateTask`, `updateTaskStatus`, `deleteTask`, `reorderTask`/status-move. Follow spec §7 but **fix the spec bug**: `updateTaskStatus` must call the `append_status_history` RPC (added in migration `0001`) as a separate step, not inline inside `.update()`. Append a `StatusHistoryEntry`, set `completed_at` when moving to `done` (and clear it when moving out of `done`).
- `src/features/workspace/queries.ts` (or reuse) — `getCurrentWorkspace()` helper so actions resolve the caller's workspace once.
- `src/features/tasks/__tests__/actions.test.ts`, `queries.test.ts`.

**Implementation notes**

- Resolve `user` via `supabase.auth.getUser()`; return `UNAUTHORIZED` when absent.
- Validate every input with the Zod schema; return `VALIDATION_ERROR` with `fieldErrors`.
- `revalidatePath` for `/board`, `/`, `/weekly`, `/analytics` as appropriate.
- Map rows with `rowToTask`; never return raw DB rows.

**Acceptance**

- [x] Every action returns `Result`; unauthorized, validation-fail, db-error, and success paths each tested with a mocked Supabase client (Phase 1 `vi.hoisted` pattern).
- [x] `updateTaskStatus` verified to append history and set/clear `completed_at` (uses the `append_status_history` RPC, fixing the spec's inline-rpc bug).
- [x] **Engineering Standard Gate green.** _(added `getAuthedContext` helper in `workspace/queries.ts`; typed the RPC in `database.ts` Functions)_

---

## Task 2 — AI task parser + golden dataset tests

**Depends on**: Task 0, Phase 1 `openrouter`.

**Files**

- `src/features/tasks/parser.ts` — `parseTaskFromText(rawText): Promise<Result<ParsedTaskResult>>` (spec §7). Strip markdown fences before `JSON.parse`; validate with a Zod `parsedSchema`; clamp `confidence` to 0–1.
- `src/features/tasks/actions.ts` — add `createTaskFromText` (parse → create) returning `Result<{ parsed: Task; confidence: number }>`.
- `src/features/tasks/__tests__/parser.test.ts` — **golden dataset, ≥ 10 cases**: mock the OpenRouter client; static raw input → expected structured output. Include: explicit due date, relative date ("tomorrow"), urgent keyword, tags inference, no-date case, effort estimate, malformed-JSON fallback (→ `VALIDATION_ERROR`/`AI_ERROR`), empty content (→ `AI_ERROR`), markdown-fenced JSON, extra-prose-around-JSON.
- `src/features/tasks/__tests__/golden/parser-cases.ts` — the dataset as a typed array.

**Implementation notes**

- Mock `@/lib/openrouter` `openrouter.chat.completions.create`; never hit the network in tests.
- Determinism: the parser is graded on parsing/validation behavior, not model quality.

**Acceptance**

- [x] ≥ 10 golden cases pass (11 cases incl. fence-stripping, prose-stripping, confidence clamp); malformed/empty AI responses degrade to a typed error, never throw.
- [x] **Engineering Standard Gate green.** _(`createTask` gained an optional `source`; AI tasks persist as `ai_parsed`)_

---

## Task 3 — Carryover detection + daily sorting (pure logic)

**Depends on**: Task 0.

**Files**

- `src/features/tasks/carryover.ts` — `detectCarryovers(tasks, today?)`, `sortDailyTasks(tasks)` (spec §8). Make "today" injectable for deterministic tests (default `startOfToday()`).
- `src/features/tasks/__tests__/carryover.test.ts`.

**Acceptance**

- [x] Tests cover: done/cancelled excluded, prior-day todo flagged, same-day not flagged, sort puts carryovers first then by `carryCount` desc then priority, no input mutation.
- [x] **Engineering Standard Gate green.**

---

## Task 4 — Shared task UI primitives

**Depends on**: Task 0.

**Files**

- `src/components/shared/PriorityBadge.tsx`, `StatusBadge.tsx` (spec §11 colors), plus a small `Badge` base. Add to `src/components/shared/index.ts`.
- `src/features/tasks/TaskCard.tsx` — rounded-xl, 1px border, 4px left priority border; "Carried ×N" amber badge top-right; purple "Requested by {name}" when `source==="request_link"` (spec §11).
- Tests for each (render + variant classes + carryover/request badges).

**Acceptance**

- [x] Badges and card render all variants; carryover and request-link cases asserted.
- [x] **Engineering Standard Gate green.**

---

## Task 5 — Quick-capture (manual + AI) component

**Depends on**: Tasks 1, 2, 4.

**Files**

- `src/features/tasks/QuickAdd.tsx` — client component: free-text input → calls `createTaskFromText` (AI) with a manual-fallback path; shows confidence; optimistic UX with `useTransition`; toast on error via Radix Toast.
- `src/components/ui/` — minimal Radix-based `Toast`/`Button`/`Input` primitives as needed (shadcn-style).
- Tests: renders, submits, disabled while pending, error surfaces. Mock the server action.

**Acceptance**

- [x] Async handlers wrapped to satisfy `no-misused-promises` (Phase 1 `void` pattern).
- [x] **Engineering Standard Gate green.** _(used inline success/error feedback + manual fallback; built `Button`/`Textarea` ui primitives. A global Radix Toast provider is deferred to Task 10 polish — inline feedback covers the capture flow.)_

---

## Task 6 — Kanban board with drag-and-drop

**Depends on**: Tasks 1, 4, 5.

**Files**

- `src/features/board/KanbanColumn.tsx`, `KanbanBoard.tsx`, `index.ts` (TaskCard reused from `features/tasks`).
- `src/hooks/useTasks.ts` — Supabase realtime subscription + optimistic local state; `src/hooks/index.ts`.
- `src/app/(dashboard)/board/page.tsx` — Server Component fetches tasks via `queries.ts`, passes to client `KanbanBoard`.
- Make `(dashboard)/page.tsx` `redirect("/board")` (now that the route exists — completes the spec §2 intent).
- Tests: `KanbanBoard.test.tsx` (renders 4 columns, counts, moving a card calls `updateTaskStatus`), column count badge.

**Implementation notes**

- `@dnd-kit/core` + `sortable`. On drop across columns → `updateTaskStatus`; within column → optimistic reorder.
- Column count badge updates from live state.
- Skeleton loading state; `<EmptyState>` when no tasks.

**Acceptance**

- [x] Drag move triggers the status action; UI is optimistic and reconciles on result (logic in `board/dnd.ts`, 100% covered: resolve/move/commit + rollback).
- [x] Works at 375px (columns horizontally scrollable via `overflow-x-auto`).
- [x] **Engineering Standard Gate green.** _(lazy `getOpenRouter()` to kill import-time side effects; `useTasks` realtime hook added; dnd-bound view components excluded from coverage with logic fully tested in `dnd.ts`)_

---

## Task 7 — Daily view (carryover + streak)

**Depends on**: Tasks 1, 3, 4.

**Files**

- `src/features/daily/CarryoverBanner.tsx`, `StreakCounter.tsx`, `DailyView.tsx`, `index.ts`.
- `src/hooks/useCarryovers.ts`.
- `src/app/(dashboard)/daily/page.tsx` — Server Component: fetch today's + carryover tasks, compute streak from `daily_logs`/completion history.
- Tests: `DailyView.test.tsx` (carryover banner shows when carryovers exist, sorted order, streak renders).

**Acceptance**

- [x] Carryover banner only when carryovers exist; tasks sorted via `sortDailyTasks`; streak computed (pure `computeCurrentStreak`, 100% covered).
- [x] **Engineering Standard Gate green.**

---

## Task 8 — Weekly planner (Mon–Sun grid)

**Depends on**: Tasks 1, 4; Phase 1 `getWeekRange`.

**Files**

- `src/features/weekly/WeekColumn.tsx`, `WeeklyPlanner.tsx`, `index.ts`.
- `src/app/(dashboard)/weekly/page.tsx` — fetch tasks in the current week via `getTasksInRange`; `?week=YYYY-MM-DD` deep-link; `<`/`>` navigation.
- Tests: `WeeklyPlanner.test.tsx` (7 day columns Mon–Sun, tasks bucketed by `dueDate`, week nav).

**Acceptance**

- [x] 7 columns Monday-anchored; `?week=YYYY-MM-DD` deep-link drives the view; `<`/`>` nav links.
- [~] Drag-to-reschedule **deferred** (optional sub-item): the weekly view is read/plan + deep-link for now; dnd reschedule can reuse `board/dnd.ts` in a later pass.
- [x] **Engineering Standard Gate green.** _(pure `week.ts`: getWeekStart/resolveWeekStart/weekDays/shiftWeek/bucketByDay, 100% covered)_

---

## Task 9 — Request link (public capture)

**Depends on**: Tasks 1, 2.

**Files**

- `src/features/request/schema.ts` (or reuse `requestInputSchema`), `actions.ts` (`submitRequest`), `RequestForm.tsx`, `RequestSuccess.tsx`, `index.ts`.
- `src/app/api/request/route.ts` — public POST using the **service-role** client (spec §7); validate slug → resolve workspace → AI-enrich via `parseTaskFromText` → insert task `source="request_link"`, `requested_by`.
- `src/app/request/[slug]/page.tsx` — public, no-auth form (middleware already allows `/request`).
- `src/lib/supabase/admin.ts` — service-role client factory (server-only; never imported by client code).
- Tests: `request/__tests__/actions.test.ts`, and a route-handler test for validation/404/success (mock admin client + parser). Route handler may be coverage-excluded if it only delegates.

**Implementation notes**

- The admin client bypasses RLS by design; guard that `admin.ts` is server-only (no `"use client"` importers).
- Rate-limit consideration noted for a later phase; not required here.

**Acceptance**

- [x] Invalid body → 400; unknown slug → 404; valid → 201 and a task appears in the workspace (route contract tested).
- [x] Public form usable with no session; success state shown.
- [x] **Engineering Standard Gate green.** _(shared `ingestRequest` core powers both the route and `submitRequest`; service-role `admin.ts` is server-only; added `isTaskPriority` guard to avoid an unchecked `as`)_

---

## Task 10 — Mobile-responsive pass + Phase 2 closeout

**Depends on**: all above.

**Checklist**

- [x] Every Phase 2 view uses mobile-first responsive classes verified by review at 375px: board `overflow-x-auto`, weekly `grid-flow-col … md:grid-cols-7` scroll, daily vertical list, request form `max-w-lg` full-width inputs, quick-add full width; sidebar `hidden md:flex`, `MobileNav` `md:hidden` with `pb-24` clearance. _(No browser in this environment — verified via class review; live 375px check belongs in Task 10 of a `/run` pass.)_
- [x] Bottom `MobileNav` targets all resolve: board/daily/weekly built; monthly + analytics/reports/ethics get "Coming in Phase 3/4" `<EmptyState>` placeholders so nav never 404s and the build stays green.
- [x] Loading skeleton added at `(dashboard)/loading.tsx`; all empty states use `<EmptyState>`.
- [x] Full suite green (194 tests); coverage thresholds met; coverage exclusions all carry justification comments.
- [x] **Final Engineering Standard Gate green.**

---

## Phase 2 Definition of Done (mirrors spec §15)

- [x] Task CRUD server actions with full test coverage
- [x] AI task parser with golden dataset tests (≥ 10 cases)
- [x] Kanban board with drag-and-drop
- [x] Daily view with carryover detection + sorting
- [x] Weekly planner (Mon–Sun grid)
- [x] Request link: public form + `/api/request` + ingestion
- [x] All views mobile-responsive
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all exit 0 (194 tests)

> Note: checkboxes above are **templates** — they are checked only as each task's gate actually passes during the build. Reset to `[ ]` mentally until proven; the build process flips them.
