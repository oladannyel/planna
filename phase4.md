# plAnna — Phase 4 Build Plan: Ethics + Polish

> **Goal**: Close the loop with weekly ethics reflection, scaffold the yearly view, surface carryovers as an in-app notification, and do the final mobile + performance polish.
> **Source of truth**: `PLANNA_BUILD_SPEC.md` (§2 ethics feature, §10 yearly scaffold, §11 UI, §12 Phase 4, §15 DoD).
> **Builds on**: Phases 1–3 (see `phase1/2/3.md`). App is live-verified against real Supabase + OpenRouter. Reuses `Result`, `getAuthedContext`, typed Supabase client, lazy `getOpenRouter()`, `detectCarryovers`, `getWeekStart`, the `Button`/`Textarea` ui primitives, and the `vi.hoisted` action-test pattern.

---

## How to use this document

Work top to bottom. A task is **not done** until its **Engineering Standard Gate** passes. Check boxes as you go; don't start task N+1 until N is green.

### Engineering Standard Gate (EVERY task)

```bash
pnpm typecheck   # exit 0
pnpm lint        # eslint . --max-warnings 0 — exit 0
pnpm test        # vitest run --coverage — exit 0, thresholds met (≥90 line/stmt/func, ≥85 branch on touched modules)
pnpm build       # exit 0
```

Plus: no `any`; no unchecked `as` (use guards / narrowing filters); every server action returns `Result<T, AppError>`; every action + utility unit-tested; new table access covered by an RLS policy; works at 375px; conventional commit per task.

### Conventions carried from Phases 2–3 (reuse)

- **Pure logic first**, 100%-covered; thin components. SVG/Recharts and framework glue stay coverage-excluded **with a justification comment**.
- **Migrations**: new SQL goes in `supabase/migrations/000N_*.sql` AND appended to `supabase/all_migrations.sql`. Apply with the session-pooler runner pattern (`SUPABASE_DB_URL` in gitignored `.env.local`; direct `db.<ref>` host is IPv6-only and unreachable). Re-verify tables over REST after.
- **Action tests** mock `getAuthedContext` / `getOpenRouter` / `next/cache` via `vi.hoisted` chainable builders.
- `exactOptionalPropertyTypes` on → omit optional keys via `...(cond ? { key } : {})`.
- Persisted JSON typed as `Json` via fresh-literal helpers (no `as`).
- `"use server"` stubs keep `async` with a scoped `// eslint-disable-next-line @typescript-eslint/require-await`.

---

## Task 0 — Migration 0004 + ethics questions CRUD

**Why first**: reflection storage and the check-in UI both depend on the question store and the storage shape.

**Decision baked in (see Open Decisions #1):** store reflection answers in `weekly_reports.ethics_answers`, which requires `narrative` to be nullable so an ethics-only row can exist before a report is generated.

**Files**

- `supabase/migrations/0004_ethics.sql` — `alter table weekly_reports alter column narrative drop not null;` (+ any helpful index). Append to `supabase/all_migrations.sql`. **User applies via the pooler runner.**
- `src/features/ethics/schema.ts` — Zod `ethicsQuestionSchema` (`question` 1–300 chars), `reflectionSchema` (`{ weekStart, answers: {questionId, question, answer}[] }`).
- `src/features/ethics/actions.ts` — `"use server"`: `addQuestion`, `updateQuestion`, `deactivateQuestion`, `reorderQuestions`. All `Result`, workspace-scoped via `getAuthedContext`.
- `src/features/ethics/queries.ts` — `getActiveQuestions()`, `getAllQuestions()`.
- `src/features/ethics/index.ts`, tests for schema + actions (mocked supabase).

**Acceptance**

- [x] Migration 0004 applied live via pooler; `weekly_reports.narrative` confirmed `is_nullable = YES`; `database.ts` updated.
- [x] Question CRUD (`add`/`update`/`deactivate`/`reorder`) returns `Result`; unauthorized / validation / db-error / success paths tested (ethics 100% lines / 88% branch).
- [x] **Engineering Standard Gate green.**

---

## Task 1 — Ethics check-in + reflection history

**Depends on**: Task 0.

**Files**

- `src/features/ethics/actions.ts` — add `saveReflection(weekStart, answers)`: upsert `weekly_reports` row for the week (insert with `narrative = null` if absent, else patch `ethics_answers`), `onConflict: "workspace_id,week_start"`, persist `ethics_answers` as `Json`.
- `src/features/ethics/queries.ts` — add `getReflection(weekStart)` and `getReflectionHistory(limit)` (recent weeks with non-null `ethics_answers`).
- `src/features/ethics/EthicsCheckin.tsx` — client: lists this week's active questions, captures answers, saves via `useTransition`/`void`; empty state + a link to add questions when none exist.
- `src/features/ethics/ReflectionHistory.tsx` — past reflections grouped by week.
- `src/features/ethics/QuestionManager.tsx` — add/edit/deactivate/reorder questions (client).
- `src/app/(dashboard)/ethics/page.tsx` — replace the placeholder: this-week check-in + question manager + history.
- Tests: `saveReflection`/`getReflection*` (mocked), component render/interaction tests.

**Acceptance**

- [x] Define questions (`QuestionManager`), answer the current week (`EthicsCheckin`, prefilled), and see history (`ReflectionHistory`); `saveReflection` upserts only `ethics_answers` so a report narrative is preserved / null on a fresh row.
- [x] Replaces the Phase 3 ethics placeholder (ethics 100% lines / 91% branch).
- [x] **Engineering Standard Gate green.**

---

## Task 2 — Toast system + carryover login notification

**Depends on**: Phase 2 `detectCarryovers`. Delivers the Radix Toast deferred in Phase 2.

**Files**

- `src/components/ui/Toast.tsx` — Radix `@radix-ui/react-toast` provider + viewport + a `useToast()` hook (`toast({ title, description, tone })`); add to `components/ui/index.ts`.
- Mount `ToastProvider` in `src/app/(dashboard)/layout.tsx` (client boundary as needed).
- `src/features/daily/CarryoverNotifier.tsx` — client: on first dashboard mount per session (guard with `sessionStorage`), if carryovers exist, fire a toast ("N tasks carried over from previous days"). Receives the count from the server layout (computed via `detectCarryovers`) to avoid a client fetch.
- Tests: `useToast` reducer/logic (pure part) + `CarryoverNotifier` (fires once when count>0, silent when 0; mock the toast hook + sessionStorage).

**Acceptance**

- [x] `ToastProvider`/`useToast` reusable app-wide (Radix), mounted in the dashboard layout; `CarryoverNotifier` fires once/session when carryovers exist, never at 0 (logic 100% covered; Radix glue coverage-excluded).
- [~] QuickAdd/report error toasts: **skipped** — those components already surface inline errors; left as-is to avoid churn. Toast is available if we want to switch later.
- [x] **Engineering Standard Gate green.**

---

## Task 3 — Yearly view scaffold (placeholder only — spec §10)

**Depends on**: none. **Scaffold only — do not build aggregation.**

**Files**

- `src/app/(dashboard)/yearly/page.tsx` — `<EmptyState>` "Coming soon" + a short note on what it'll show (12-month heatmap, year narrative, YoY). `generateYearlySummary` stub already exists in `reports/actions.ts`.
- Optionally add a "Yearly" sidebar item (see Open Decisions #2).

**Acceptance**

- [x] `/yearly` renders the "Coming soon" scaffold; no aggregation logic; `generateYearlySummary` stub already exists.
- [x] "Yearly" sidebar item added with a "soon" badge (decision 2); `NavItem.upcoming` flag drives it.
- [x] **Engineering Standard Gate green.**

---

## Task 4 — Full mobile polish pass

**Depends on**: all feature work above.

**Checklist**

- [x] Code-level mobile pass: explicit `viewport` + dark `themeColor` (#0F0F13) so mobile browser chrome matches the canvas; board horizontal scroll given `snap-x` + columns `snap-start`; confirmed existing responsive classes (sidebar `hidden md:flex`, `MobileNav md:hidden`, `pb-24` clearance, stat/chart grids stack).
- [x] `MobileNav` tabs (board/daily/weekly/monthly) all resolve; active states present.
- [x] Skeletons (`(dashboard)/loading.tsx`) + `<EmptyState>` used throughout.
- [~] **Live 375px visual sweep pending a `/run` pass** (no browser in build env) — code-level fixes applied; record screenshots when running the dev server.
- [x] **Engineering Standard Gate green.**

> No browser in the build env — do the visual 375px sweep in a `/run` pass (dev server on :3001) and record findings; fix in code.

---

## Task 5 — Performance pass

**Depends on**: Task 4.

**Files / changes**

- Dynamic-import the Recharts charts (`next/dynamic`, `ssr: false`) so the analytics route's initial JS shrinks (it was ~107 kB first-load — Recharts dominates). Keep `OnTimeRateCard` static.
- Confirm `next/font` Inter uses `display: swap`; add `metadata`/viewport where missing; ensure no `<img>` (use `next/image` if any added).
- Re-check route bundle sizes in `next build` output; note before/after for analytics.

**Acceptance**

- [x] Analytics first-load JS **194 kB → 89.4 kB** (route 107 kB → 1.9 kB) via `next/dynamic` lazy charts + bypassing the barrel's static chart re-exports; font `display: swap` set.
- [~] Lighthouse mobile ≥ 90 — **pending browser pass** (no headless Chrome in build env); record score from a `/run` pass.
- [x] **Engineering Standard Gate green.**

---

## Task 6 — Phase 4 closeout

**Checklist**

- [x] Only `/yearly` carries a "Coming soon" placeholder (intentional); ethics is real.
- [x] `supabase/all_migrations.sql` includes 0004; live DB re-verified (narrative nullable).
- [x] Full suite green (302 tests); coverage thresholds met; every exclusion justified.
- [x] Live smoke re-run: `POST /api/request` → 201 (no regression); `weekly_reports` insert w/o narrative → 201 with `narrative=null` + stored `ethics_answers` (proves 0004 end-to-end).
- [x] **Final Engineering Standard Gate green** → Phase 4 complete.

---

## Phase 4 Definition of Done (spec §12)

- [x] Ethics check-in with user-defined questions
- [x] Yearly view scaffold (placeholder only)
- [x] Carryover notification (in-app toast on login)
- [x] Full mobile polish pass (code-level; live 375px sweep pending a `/run`)
- [~] Performance audit — analytics first-load cut 194→89 kB; Lighthouse ≥ 90 pending a browser pass
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all exit 0 (302 tests)

---

## Open decisions to confirm before building

1. **Ethics answer storage** — keep the spec's `weekly_reports.ethics_answers` column (needs migration 0004 making `narrative` nullable), or add a dedicated `ethics_reflections` table? _(Leaning: migration 0004 + reuse `weekly_reports`, per spec.)_
2. **Yearly in the nav** — add a "Yearly" sidebar item now (pointing at the scaffold), or leave `/yearly` unlinked until it's built? _(Leaning: add it, styled as upcoming.)_
3. **Carryover notification scope** — transient toast once per session on dashboard load (simple), or a persistent notification center with a bell + unread count? _(Leaning: transient toast for Phase 4; bell is future.)_
4. **Lighthouse** — confirmed as a manual/browser gate (can't run headless Chrome in the build env); I'll record the score from a `/run` pass rather than block the code gate on it.
