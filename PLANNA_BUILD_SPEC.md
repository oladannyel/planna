# plAnna — Claude Code Build Specification

> **Stack**: Next.js 14 (App Router) · TypeScript (strict) · Supabase · OpenRouter · Vercel  
> **Engineering standard**: Fortune 100 TypeScript — zero regressions, zero lint warnings, full type coverage  
> **Author**: Daniel Olaniyan · Sperktar Lab

---

## 0. Engineering Standards (Non-Negotiable)

Every file produced must pass all of the following before being considered done. Claude Code must run these checks after every phase and fix all failures before proceeding.

```bash
# These must all exit 0 before moving to the next phase
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint . --max-warnings 0
pnpm test          # vitest run --coverage (≥ 90% coverage on all new modules)
pnpm build         # next build (zero build errors)
```

### TypeScript Rules

- `strict: true` in `tsconfig.json` — no exceptions
- No `any` types — use `unknown` and narrow, or define explicit interfaces
- All async functions return `Promise<Result<T, AppError>>` using the `Result<T,E>` pattern (see `src/lib/result.ts`)
- All environment variables validated with Zod at startup via `src/lib/env.ts`
- No `as` type assertions unless preceded by a runtime check
- Barrel exports (`index.ts`) for every feature module

### Linting Rules

- ESLint config: `@typescript-eslint/recommended-type-checked` + `next/core-web-vitals`
- `no-console` rule enabled — use the logger utility (`src/lib/logger.ts`) everywhere
- Import order enforced: external → internal → relative, alphabetical within groups
- `@typescript-eslint/no-floating-promises` enabled — every Promise must be awaited or explicitly handled

### Testing Rules

- Vitest with `@testing-library/react` for component tests
- Every server action must have a unit test
- Every utility function must have a unit test
- Database operations: use Supabase local emulator for integration tests
- Golden dataset pattern for AI parser tests (static input → expected structured output)
- Test file co-location: `src/features/tasks/__tests__/parser.test.ts`

### Git Hooks (Husky)

```bash
# .husky/pre-commit
pnpm lint-staged   # runs eslint + prettier on staged files only

# .husky/pre-push
pnpm typecheck && pnpm test
```

### Regression Policy

- No PR (and no phase completion) unless `pnpm test` passes with ≥ 90% coverage on touched files
- Snapshot tests for all UI components that render task cards, kanban columns, and report views
- Any change to the database schema requires a migration file — never mutate tables directly

---

## 1. Project Initialisation

```bash
pnpm create next-app@latest planna \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd planna

# Core dependencies
pnpm add @supabase/supabase-js @supabase/ssr \
  openai \
  zod \
  @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities \
  recharts \
  date-fns \
  lucide-react \
  clsx tailwind-merge \
  @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-select @radix-ui/react-toast \
  @radix-ui/react-tabs @radix-ui/react-badge

# Dev dependencies
pnpm add -D \
  vitest @vitejs/plugin-react \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  @vitest/coverage-v8 \
  husky lint-staged \
  prettier prettier-plugin-tailwindcss \
  @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  eslint-plugin-import \
  msw

# Initialise husky
pnpm exec husky init
```

---

## 2. Repository Structure

Scaffold this exact directory tree before writing any feature code:

```
planna/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx           # sidebar + nav shell
│   │   │   ├── page.tsx             # redirects → /board
│   │   │   ├── board/
│   │   │   │   └── page.tsx         # Kanban view
│   │   │   ├── daily/
│   │   │   │   └── page.tsx         # Daily view
│   │   │   ├── weekly/
│   │   │   │   └── page.tsx         # Weekly planner
│   │   │   ├── monthly/
│   │   │   │   └── page.tsx         # Monthly calendar + summary
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx         # Performance dashboard
│   │   │   ├── reports/
│   │   │   │   └── page.tsx         # Weekly + monthly AI reports
│   │   │   └── ethics/
│   │   │       └── page.tsx         # Ethics reflection
│   │   ├── request/
│   │   │   └── [slug]/
│   │   │       └── page.tsx         # Public request form (no auth)
│   │   ├── api/
│   │   │   ├── tasks/
│   │   │   │   └── route.ts
│   │   │   ├── parse/
│   │   │   │   └── route.ts         # AI task parser endpoint
│   │   │   ├── report/
│   │   │   │   └── route.ts         # AI report generator
│   │   │   └── request/
│   │   │       └── route.ts         # Public request ingestion
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── features/
│   │   ├── tasks/
│   │   │   ├── actions.ts           # Server actions: createTask, updateTask, etc.
│   │   │   ├── queries.ts           # Supabase query functions
│   │   │   ├── schema.ts            # Zod schemas for Task
│   │   │   ├── types.ts             # Task, TaskStatus, Priority interfaces
│   │   │   ├── parser.ts            # AI parser: raw text → TaskInput
│   │   │   ├── carryover.ts         # Carryover detection + flagging logic
│   │   │   ├── index.ts             # Barrel export
│   │   │   └── __tests__/
│   │   │       ├── actions.test.ts
│   │   │       ├── parser.test.ts   # Golden dataset tests
│   │   │       └── carryover.test.ts
│   │   │
│   │   ├── board/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       └── KanbanBoard.test.tsx
│   │   │
│   │   ├── daily/
│   │   │   ├── DailyView.tsx
│   │   │   ├── CarryoverBanner.tsx
│   │   │   ├── StreakCounter.tsx
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       └── DailyView.test.tsx
│   │   │
│   │   ├── weekly/
│   │   │   ├── WeeklyPlanner.tsx
│   │   │   ├── WeekColumn.tsx
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       └── WeeklyPlanner.test.tsx
│   │   │
│   │   ├── monthly/
│   │   │   ├── MonthlyCalendar.tsx  # Grid calendar with task dots
│   │   │   ├── MonthlyStats.tsx     # Completion stats for the month
│   │   │   ├── MonthlySummary.tsx   # AI-generated monthly narrative
│   │   │   ├── actions.ts           # generateMonthlySummary server action
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       ├── MonthlyCalendar.test.tsx
│   │   │       └── actions.test.ts
│   │   │
│   │   ├── analytics/
│   │   │   ├── TasksPerDayChart.tsx
│   │   │   ├── CycleTimeChart.tsx
│   │   │   ├── CategoryBreakdown.tsx
│   │   │   ├── OnTimeRateCard.tsx
│   │   │   ├── queries.ts           # Analytics-specific DB queries
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       └── queries.test.ts
│   │   │
│   │   ├── reports/
│   │   │   ├── WeeklyReport.tsx
│   │   │   ├── MonthlyReport.tsx    # Monthly AI narrative display
│   │   │   ├── actions.ts           # generateWeeklyReport, generateMonthlyReport
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       └── actions.test.ts
│   │   │
│   │   ├── ethics/
│   │   │   ├── EthicsCheckin.tsx
│   │   │   ├── ReflectionHistory.tsx
│   │   │   ├── actions.ts
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   │       └── actions.test.ts
│   │   │
│   │   └── request/
│   │       ├── RequestForm.tsx      # Public-facing form (no auth)
│   │       ├── RequestSuccess.tsx
│   │       ├── actions.ts           # submitRequest server action
│   │       ├── schema.ts            # Zod schema for RequestInput
│   │       ├── index.ts
│   │       └── __tests__/
│   │           └── actions.test.ts
│   │
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives (Button, Input, etc.)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── MobileNav.tsx        # Bottom nav for mobile
│   │   │   ├── TopBar.tsx
│   │   │   └── index.ts
│   │   └── shared/
│   │       ├── PriorityBadge.tsx
│   │       ├── StatusBadge.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── EmptyState.tsx
│   │       └── index.ts
│   │
│   ├── lib/
│   │   ├── result.ts                # Result<T,E> type + ok/err helpers
│   │   ├── env.ts                   # Zod-validated environment variables
│   │   ├── logger.ts                # Structured logger (replaces console.*)
│   │   ├── openrouter.ts            # OpenRouter client (openai SDK, baseURL override)
│   │   ├── supabase/
│   │   │   ├── client.ts            # Browser Supabase client
│   │   │   ├── server.ts            # Server Supabase client (SSR)
│   │   │   └── middleware.ts        # Session refresh middleware
│   │   ├── date.ts                  # date-fns wrappers: getWeekRange, getMonthRange
│   │   └── cn.ts                   # clsx + tailwind-merge utility
│   │
│   ├── hooks/
│   │   ├── useTasks.ts              # SWR/realtime task subscription
│   │   ├── useCarryovers.ts
│   │   ├── useMonthlyStats.ts       # Aggregated monthly data
│   │   ├── useAnalytics.ts
│   │   └── index.ts
│   │
│   └── types/
│       ├── database.ts              # Generated Supabase types (supabase gen types)
│       ├── api.ts                   # API request/response types
│       └── index.ts
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_rls_policies.sql
│   │   └── 0003_monthly_summary.sql  # monthly_summaries table
│   └── seed.sql
│
├── .env.local.example
├── .eslintrc.json
├── .prettierrc
├── vitest.config.ts
├── vitest.setup.ts
├── tailwind.config.ts
├── tsconfig.json
└── PLANNA_BUILD_SPEC.md             # this file
```

---

## 3. Configuration Files

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `.eslintrc.json`

```json
{
  "extends": ["next/core-web-vitals", "plugin:@typescript-eslint/recommended-type-checked"],
  "plugins": ["@typescript-eslint", "import"],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": true,
    "tsconfigRootDir": "__dirname"
  },
  "rules": {
    "no-console": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "import/order": [
      "error",
      {
        "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
        "alphabetize": { "order": "asc" },
        "newlines-between": "always"
      }
    ]
  }
}
```

### `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### `vitest.config.ts`

```typescript
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      exclude: [
        "node_modules/",
        "src/app/**", // Next.js pages — test via e2e
        "src/types/**",
        "**/*.config.*",
        "**/index.ts", // barrel exports
      ],
    },
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
```

### `vitest.setup.ts`

```typescript
import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

### `lint-staged.config.js`

```javascript
export default {
  "*.{ts,tsx}": ["eslint --max-warnings 0 --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"],
};
```

### `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm lint-staged
```

### `.husky/pre-push`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
pnpm typecheck && pnpm test
```

---

## 4. Core Library Files

### `src/lib/result.ts`

```typescript
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export type AppError =
  | { code: "DB_ERROR"; message: string; cause?: unknown }
  | { code: "AI_ERROR"; message: string; cause?: unknown }
  | { code: "VALIDATION_ERROR"; message: string; fields?: Record<string, string[]> }
  | { code: "NOT_FOUND"; message: string }
  | { code: "UNAUTHORIZED"; message: string }
  | { code: "RATE_LIMIT"; message: string };
```

### `src/lib/env.ts`

```typescript
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_FREE_MODEL: z.string().default("mistralai/mistral-7b-instruct:free"),
  OPENROUTER_REPORT_MODEL: z.string().default("google/gemma-2-9b-it:free"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

### `src/lib/openrouter.ts`

```typescript
import OpenAI from "openai";

import { env } from "@/lib/env";

// OpenRouter is OpenAI-compatible — same SDK, different baseURL + headers
export const openrouter = new OpenAI({
  baseURL: env.OPENROUTER_BASE_URL,
  apiKey: env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
    "X-Title": "plAnna",
  },
});
```

---

## 5. Database Schema

Run migrations in order via `supabase db push` or the Supabase dashboard.

### `supabase/migrations/0001_initial_schema.sql`

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── WORKSPACES ───────────────────────────────────────────────────────────────
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  slug        text not null unique,       -- used for request links: /request/[slug]
  created_at  timestamptz not null default now()
);

-- ─── TASKS ────────────────────────────────────────────────────────────────────
create type task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type task_source as enum ('manual', 'ai_parsed', 'request_link');

create table tasks (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  title             text not null,
  description       text,
  status            task_status not null default 'todo',
  priority          task_priority not null default 'medium',
  tags              text[] not null default '{}',
  due_date          date,
  estimated_minutes integer,                        -- AI-estimated effort
  source            task_source not null default 'manual',
  requested_by      text,                           -- name from request link
  carried_over      boolean not null default false,
  carry_count       integer not null default 0,     -- how many times deferred
  status_history    jsonb not null default '[]',    -- [{status, changed_at}]
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index tasks_workspace_status_idx on tasks(workspace_id, status);
create index tasks_workspace_due_idx on tasks(workspace_id, due_date);
create index tasks_workspace_created_idx on tasks(workspace_id, created_at);

-- ─── DAILY LOGS ───────────────────────────────────────────────────────────────
-- Snapshot written nightly via cron (Supabase pg_cron or Vercel cron)
create table daily_logs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  log_date        date not null,
  completed_count integer not null default 0,
  created_count   integer not null default 0,
  carried_count   integer not null default 0,
  on_time_count   integer not null default 0,       -- completed before due_date
  unique(workspace_id, log_date)
);

-- ─── WEEKLY REPORTS ───────────────────────────────────────────────────────────
create table weekly_reports (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  week_start      date not null,                    -- always Monday
  narrative       text not null,                    -- AI-generated prose
  stats           jsonb not null default '{}',      -- raw numbers snapshot
  ethics_answers  jsonb,                            -- {question, answer}[]
  created_at      timestamptz not null default now(),
  unique(workspace_id, week_start)
);

-- ─── MONTHLY SUMMARIES ────────────────────────────────────────────────────────
create table monthly_summaries (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  year            integer not null,
  month           integer not null check (month between 1 and 12),
  narrative       text not null,                    -- AI-generated monthly prose
  stats           jsonb not null default '{}',      -- aggregated monthly numbers
  top_categories  jsonb not null default '[]',      -- [{tag, count}] top 5
  created_at      timestamptz not null default now(),
  unique(workspace_id, year, month)
);

-- ─── ETHICS QUESTIONS ─────────────────────────────────────────────────────────
-- User-defined weekly reflection questions
create table ethics_questions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  question      text not null,
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();
```

### `supabase/migrations/0002_rls_policies.sql`

```sql
-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table workspaces       enable row level security;
alter table tasks             enable row level security;
alter table daily_logs        enable row level security;
alter table weekly_reports    enable row level security;
alter table monthly_summaries enable row level security;
alter table ethics_questions  enable row level security;

-- Workspace: owner only
create policy "workspace_owner" on workspaces
  for all using (auth.uid() = owner_id);

-- Tasks: workspace owner only
create policy "tasks_owner" on tasks
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- Task insert via request link: service role only (anon cannot write tasks directly)
-- The /api/request route uses SUPABASE_SERVICE_ROLE_KEY after validating the slug

-- Daily logs, reports, summaries: workspace owner only
create policy "daily_logs_owner" on daily_logs
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "weekly_reports_owner" on weekly_reports
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "monthly_summaries_owner" on monthly_summaries
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "ethics_questions_owner" on ethics_questions
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );
```

---

## 6. Core Type Definitions

### `src/features/tasks/types.ts`

```typescript
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskSource = "manual" | "ai_parsed" | "request_link";

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  dueDate: string | null; // ISO date string "YYYY-MM-DD"
  estimatedMinutes: number | null;
  source: TaskSource;
  requestedBy: string | null;
  carriedOver: boolean;
  carryCount: number;
  statusHistory: StatusHistoryEntry[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryEntry {
  status: TaskStatus;
  changedAt: string; // ISO timestamp
}

export interface TaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  tags: string[];
  dueDate?: string;
  estimatedMinutes?: number;
}

export interface ParsedTaskResult {
  title: string;
  priority: TaskPriority;
  tags: string[];
  dueDate: string | null;
  estimatedMinutes: number | null;
  confidence: number; // 0–1, for UI feedback
}
```

### `src/features/tasks/schema.ts`

```typescript
import { z } from "zod";

export const taskInputSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  tags: z.array(z.string().min(1).max(50)).max(10),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  estimatedMinutes: z.number().int().positive().max(14400).optional(),
});

export const requestInputSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(10).max(5000),
  requesterName: z.string().min(1).max(100),
  urgency: z.enum(["low", "medium", "high", "urgent"]),
  desiredDeadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  slug: z.string().min(1), // workspace slug from URL
});

export type TaskInputSchema = z.infer<typeof taskInputSchema>;
export type RequestInputSchema = z.infer<typeof requestInputSchema>;
```

---

## 7. Key Server Actions

### `src/features/tasks/parser.ts`

```typescript
import { z } from "zod";

import { env } from "@/lib/env";
import { openrouter } from "@/lib/openrouter";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { ParsedTaskResult } from "./types";

const parsedSchema = z.object({
  title: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  tags: z.array(z.string()),
  dueDate: z.string().nullable(),
  estimatedMinutes: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_PROMPT = `You are a task parser. Extract structured task data from natural language input.
Today's date: ${new Date().toISOString().split("T")[0]}.
Respond ONLY with valid JSON matching this shape exactly:
{
  "title": "clean concise task title",
  "priority": "low" | "medium" | "high" | "urgent",
  "tags": ["tag1", "tag2"],
  "dueDate": "YYYY-MM-DD" | null,
  "estimatedMinutes": number | null,
  "confidence": 0.0–1.0
}
No preamble, no markdown, no explanation. JSON only.`;

export async function parseTaskFromText(rawText: string): Promise<Result<ParsedTaskResult>> {
  try {
    const response = await openrouter.chat.completions.create({
      model: env.OPENROUTER_FREE_MODEL,
      max_tokens: 300,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawText },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return err({ code: "AI_ERROR", message: "Empty response from AI parser" });
    }

    const parsed: unknown = JSON.parse(content);
    const validated = parsedSchema.safeParse(parsed);

    if (!validated.success) {
      return err({
        code: "VALIDATION_ERROR",
        message: "AI returned invalid structure",
        fields: validated.error.flatten().fieldErrors as Record<string, string[]>,
      });
    }

    return ok(validated.data);
  } catch (cause) {
    return err({ code: "AI_ERROR", message: "Task parsing failed", cause });
  }
}
```

### `src/features/tasks/actions.ts`

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { taskInputSchema } from "./schema";
import { parseTaskFromText } from "./parser";
import type { Task, TaskInput, TaskStatus } from "./types";

export async function createTask(input: TaskInput): Promise<Result<Task>> {
  const validated = taskInputSchema.safeParse(input);
  if (!validated.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: "Invalid task input",
      fields: validated.error.flatten().fieldErrors as Record<string, string[]>,
    });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "UNAUTHORIZED", message: "Not authenticated" });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!workspace) return err({ code: "NOT_FOUND", message: "Workspace not found" });

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspace.id,
      title: validated.data.title,
      description: validated.data.description ?? null,
      priority: validated.data.priority,
      tags: validated.data.tags,
      due_date: validated.data.dueDate ?? null,
      estimated_minutes: validated.data.estimatedMinutes ?? null,
      source: "manual",
      status_history: [{ status: "todo", changedAt: new Date().toISOString() }],
    })
    .select()
    .single();

  if (error) return err({ code: "DB_ERROR", message: error.message, cause: error });

  revalidatePath("/board");
  revalidatePath("/daily");

  return ok(data as Task);
}

export async function createTaskFromText(
  rawText: string,
): Promise<Result<{ parsed: Task; confidence: number }>> {
  const parseResult = await parseTaskFromText(rawText);
  if (!parseResult.ok) return parseResult;

  const createResult = await createTask({
    title: parseResult.value.title,
    priority: parseResult.value.priority,
    tags: parseResult.value.tags,
    dueDate: parseResult.value.dueDate ?? undefined,
    estimatedMinutes: parseResult.value.estimatedMinutes ?? undefined,
  });

  if (!createResult.ok) return createResult;

  return ok({ parsed: createResult.value, confidence: parseResult.value.confidence });
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Result<Task>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "UNAUTHORIZED", message: "Not authenticated" });

  const historyEntry = { status, changedAt: new Date().toISOString() };
  const completedAt = status === "done" ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status,
      completed_at: completedAt,
      status_history: supabase.rpc("append_status_history", {
        task_id: taskId,
        entry: historyEntry,
      }),
    })
    .eq("id", taskId)
    .select()
    .single();

  if (error) return err({ code: "DB_ERROR", message: error.message, cause: error });

  revalidatePath("/board");
  revalidatePath("/daily");
  revalidatePath("/analytics");

  return ok(data as Task);
}
```

### `src/features/monthly/actions.ts`

```typescript
"use server";

import { startOfMonth, endOfMonth, format } from "date-fns";

import { env } from "@/lib/env";
import { openrouter } from "@/lib/openrouter";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

export interface MonthlySummaryResult {
  narrative: string;
  stats: {
    totalCreated: number;
    totalCompleted: number;
    totalCarried: number;
    completionRate: number;
    avgCycleTimeHours: number;
    onTimeRate: number;
    topTags: Array<{ tag: string; count: number }>;
  };
}

export async function generateMonthlySummary(
  year: number,
  month: number,
): Promise<Result<MonthlySummaryResult>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "UNAUTHORIZED", message: "Not authenticated" });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!workspace) return err({ code: "NOT_FOUND", message: "Workspace not found" });

  const start = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
  const end = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", workspace.id)
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) return err({ code: "DB_ERROR", message: error.message });

  const completed = tasks?.filter((t) => t.status === "done") ?? [];
  const carried = tasks?.filter((t) => t.carried_over) ?? [];
  const onTime = completed.filter(
    (t) => t.due_date && t.completed_at && t.completed_at <= t.due_date + "T23:59:59Z",
  );

  const tagCounts = (tasks ?? [])
    .flatMap((t) => t.tags as string[])
    .reduce<Record<string, number>>((acc, tag) => ({ ...acc, [tag]: (acc[tag] ?? 0) + 1 }), {});

  const topTags = Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  const stats = {
    totalCreated: tasks?.length ?? 0,
    totalCompleted: completed.length,
    totalCarried: carried.length,
    completionRate: tasks?.length ? Math.round((completed.length / tasks.length) * 100) : 0,
    avgCycleTimeHours: 0, // compute from status_history if needed
    onTimeRate: completed.length ? Math.round((onTime.length / completed.length) * 100) : 0,
    topTags,
  };

  const prompt = `You are a productivity coach. Write a concise 3-paragraph monthly performance summary for ${format(new Date(year, month - 1), "MMMM yyyy")}.

Data:
- Tasks created: ${stats.totalCreated}
- Completed: ${stats.totalCompleted} (${stats.completionRate}% completion rate)
- Carried over without completion: ${stats.totalCarried}
- On-time completion rate: ${stats.onTimeRate}%
- Top focus areas: ${topTags.map((t) => t.tag).join(", ") || "none tagged"}

Paragraph 1: What was accomplished this month.
Paragraph 2: Where momentum broke down or tasks got stuck.
Paragraph 3: One concrete behavioural recommendation for next month.

Write in second person ("you"), be specific, no generic platitudes.`;

  try {
    const response = await openrouter.chat.completions.create({
      model: env.OPENROUTER_REPORT_MODEL,
      max_tokens: 600,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });

    const narrative = response.choices[0]?.message?.content ?? "Summary unavailable.";

    // Persist to DB
    await supabase.from("monthly_summaries").upsert({
      workspace_id: workspace.id,
      year,
      month,
      narrative,
      stats,
      top_categories: topTags,
    });

    return ok({ narrative, stats });
  } catch (cause) {
    return err({ code: "AI_ERROR", message: "Monthly summary generation failed", cause });
  }
}
```

### `src/app/api/request/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { requestInputSchema } from "@/features/request/schema";
import { parseTaskFromText } from "@/features/tasks/parser";

// Uses service role — this route is public (no auth cookie)
const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const validated = requestInputSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validated.error.flatten() },
        { status: 400 },
      );
    }

    const { slug, requesterName, title, description, urgency, desiredDeadline } = validated.data;

    // Resolve workspace from slug
    const { data: workspace, error: wsError } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("slug", slug)
      .single();

    if (wsError ?? !workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // AI-enrich the submission
    const rawText = `${title}. ${description}. Priority: ${urgency}. ${desiredDeadline ? `Deadline: ${desiredDeadline}` : ""}`;
    const parseResult = await parseTaskFromText(rawText);
    const parsed = parseResult.ok ? parseResult.value : null;

    const { error: insertError } = await supabaseAdmin.from("tasks").insert({
      workspace_id: workspace.id,
      title: parsed?.title ?? title,
      description,
      priority: parsed?.priority ?? urgency,
      tags: parsed?.tags ?? [],
      due_date: parsed?.dueDate ?? desiredDeadline ?? null,
      estimated_minutes: parsed?.estimatedMinutes ?? null,
      source: "request_link",
      requested_by: requesterName,
      status_history: [{ status: "todo", changedAt: new Date().toISOString() }],
    });

    if (insertError) {
      logger.error("Request link insert failed", { error: insertError });
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (cause) {
    logger.error("Request route error", { cause });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

## 8. Carryover Logic

### `src/features/tasks/carryover.ts`

```typescript
import { isBefore, startOfToday, parseISO } from "date-fns";

import type { Task } from "./types";

/**
 * Returns tasks that should be flagged as carried over.
 * A task is a carryover if: status is 'todo' or 'in_progress',
 * and it was created on a previous day (not today).
 */
export function detectCarryovers(tasks: Task[]): Task[] {
  const today = startOfToday();
  return tasks.filter((task) => {
    if (task.status === "done" || task.status === "cancelled") return false;
    const createdDate = parseISO(task.createdAt);
    return isBefore(createdDate, today);
  });
}

/**
 * Returns tasks sorted: carryovers first (by carryCount desc), then by priority.
 */
const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortDailyTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.carriedOver !== b.carriedOver) return a.carriedOver ? -1 : 1;
    if (a.carryCount !== b.carryCount) return b.carryCount - a.carryCount;
    return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
  });
}
```

---

## 9. Monthly View Specification

The monthly view has three components rendered together on `/monthly`:

**`MonthlyCalendar.tsx`** — A full month grid (7 columns, 4–6 rows). Each day cell shows:

- Date number
- Coloured dot per task (green = done, amber = in progress, red = overdue)
- Clicking a day opens a side panel with that day's tasks

**`MonthlyStats.tsx`** — Stat cards row above the calendar:

- Total created this month
- Completion rate (%)
- Carryover rate (%)
- On-time rate (%)
- Best streak (longest consecutive days with ≥1 task completed)

**`MonthlySummary.tsx`** — Below the calendar. Shows the AI narrative if already generated. Has a "Generate Summary" button that calls `generateMonthlySummary`. Button disabled if already generated this month. Shows a loading skeleton while generating. Persists to DB so it only generates once per month.

Month navigation: `<` and `>` arrows to move between months. URL param `?month=2026-06` drives the view so deep-linking works.

---

## 10. Yearly View (Future Phase)

> **Do not build this in Phase 1–4. Scaffold only.**

Placeholder page at `/yearly` with a `<EmptyState>` component and a "Coming soon" message. The DB schema already supports it — `monthly_summaries` table aggregates by year/month. When built, the yearly view will show:

- A 12-month heatmap grid (GitHub-style, tasks/day intensity)
- Year-level AI narrative (`generateYearlySummary` server action reading all 12 monthly summaries)
- Year-over-year comparison (once 2+ years of data exist)

The `generateYearlySummary` function signature to pre-define now (stub only):

```typescript
// src/features/reports/actions.ts — add this stub
export async function generateYearlySummary(year: number): Promise<Result<never>> {
  return err({ code: "NOT_FOUND", message: "Yearly summary not yet implemented" });
}
```

---

## 11. UI Design Directives

Claude Code must follow these design decisions. Do not deviate.

**Colour palette** (dark-first, light mode as secondary):

```
Background:   #0F0F13 (darkest), #17171F (cards), #1E1E2E (borders)
Text:         #F8FAFC (primary), #94A3B8 (secondary), #475569 (muted)
Purple:       #7C3AED (primary accent — tasks, AI actions)
Teal:         #0D9488 (success, done states)
Amber:        #D97706 (carryovers, warnings)
Red:          #DC2626 (overdue, urgent)
```

**Typography**: Inter via `next/font/google`. Weights: 400 regular, 500 medium, 700 bold only.

**Mobile-first**: Every component must be usable on a 375px screen. Navigation on mobile = bottom tab bar (board, daily, weekly, monthly). Sidebar visible on ≥ 768px only.

**Component rules**:

- Task cards: rounded-xl, 1px border, no shadow. Priority shown as a left-edge coloured border (4px, full height)
- Kanban columns: scrollable vertically, fixed header. Column count badge updates in real-time
- Carryover tasks: amber left border + "Carried ×N" badge in top-right of card
- Request-link tasks: purple "Requested by [Name]" badge below the title
- All loading states: skeleton screens, never spinners alone
- All empty states: `<EmptyState>` component with icon + message + primary action

---

## 12. Build Phases

### Phase 1 — Foundation (complete before any UI work)

- [ ] Project init with all config files exactly as specified above
- [ ] Supabase project created, migrations run, types generated (`supabase gen types typescript`)
- [ ] Auth working (Google OAuth + magic link)
- [ ] Workspace auto-created on first login with a generated slug
- [ ] `src/lib/result.ts`, `env.ts`, `logger.ts`, `openrouter.ts` written and tested
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all exit 0

### Phase 2 — Capture + Execute

- [ ] Task CRUD server actions with full test coverage
- [ ] AI task parser with golden dataset tests (min 10 test cases)
- [ ] Kanban board with drag-and-drop (`@dnd-kit`)
- [ ] Daily view with carryover detection and sorting
- [ ] Weekly planner (Mon–Sun grid)
- [ ] Request link: public form + `/api/request` route + ingestion
- [ ] All views mobile-responsive

### Phase 3 — Insight

- [ ] Analytics dashboard (all 4 charts with Recharts)
- [ ] Weekly report generation + storage
- [ ] Monthly view: calendar + stats + AI summary
- [ ] Monthly summary generation + storage

### Phase 4 — Ethics + Polish

- [ ] Ethics check-in component with user-defined questions
- [ ] Yearly view scaffold (placeholder only)
- [ ] Notification system for carryovers (in-app toast on login)
- [ ] Full mobile polish pass
- [ ] Performance audit (Lighthouse ≥ 90 on mobile)
- [ ] Final: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all exit 0

---

## 13. Environment Variables

### `.env.local.example`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter (free models, zero cost)
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_FREE_MODEL=mistralai/mistral-7b-instruct:free
OPENROUTER_REPORT_MODEL=google/gemma-2-9b-it:free

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 14. Git Commit Convention

```
feat(tasks): add AI parser with golden dataset tests
fix(carryover): correct timezone handling in detectCarryovers
test(monthly): add coverage for generateMonthlySummary
chore(deps): upgrade @dnd-kit to 6.1.0
refactor(board): extract TaskCard into shared component
```

Format: `type(scope): description` — lowercase, imperative, no period.

---

## 15. Definition of Done

A feature is done when:

1. All acceptance criteria above are met
2. `pnpm typecheck` exits 0
3. `pnpm lint` exits 0 (`--max-warnings 0`)
4. `pnpm test` exits 0 with ≥ 90% coverage on all touched files
5. `pnpm build` exits 0
6. The feature works on a 375px mobile screen (verified in browser devtools)
7. All new server actions use `Result<T, AppError>` — no raw throws
8. No `any` types introduced
9. Every new Supabase query has a corresponding RLS policy
