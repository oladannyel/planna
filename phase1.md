# Productivity OS — Phase 1: Foundation

> **Claude Code Instructions**: Execute every step in this document sequentially.  
> After every file creation, continue to the next. Do not skip steps.  
> Run the verification block at the end. All 4 commands must exit 0 before Phase 1 is complete.

---

## What Phase 1 Builds

By the end of this document you will have:

- Next.js 14 App Router project with strict TypeScript, ESLint, Prettier, Vitest, and Husky
- Supabase schema (all tables, indexes, RLS policies, triggers)
- Google OAuth + magic link authentication
- Workspace auto-creation on first login with a unique slug
- Dashboard shell with sidebar (desktop) and bottom nav (mobile)
- All core lib files: `result.ts`, `env.ts`, `logger.ts`, `openrouter.ts`, Supabase clients
- Protected routes via Next.js middleware
- A working app you can log into at `localhost:3000`

---

## Step 1 — Scaffold the Project

Run these commands exactly in your terminal:

```bash
pnpm create next-app@latest productivity-os \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git

cd productivity-os

# Core runtime dependencies
pnpm add \
  @supabase/supabase-js \
  @supabase/ssr \
  openai \
  zod \
  date-fns \
  lucide-react \
  clsx \
  tailwind-merge \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-select \
  @radix-ui/react-toast \
  @radix-ui/react-tabs \
  @radix-ui/react-avatar \
  @radix-ui/react-separator \
  @radix-ui/react-tooltip

# Dev dependencies
pnpm add -D \
  vitest \
  @vitejs/plugin-react \
  @testing-library/react \
  @testing-library/user-event \
  @testing-library/jest-dom \
  @vitest/coverage-v8 \
  husky \
  lint-staged \
  prettier \
  prettier-plugin-tailwindcss \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint-plugin-import \
  msw \
  @types/node

# Initialise git and husky
git init
pnpm exec husky init
```

---

## Step 2 — Delete Default Next.js Boilerplate

Delete these files that Next.js scaffolds by default:

```bash
rm -f src/app/page.tsx
rm -f src/app/globals.css
rm -f src/app/layout.tsx
rm -f src/app/favicon.ico
rm -rf public/next.svg
rm -rf public/vercel.svg
```

---

## Step 3 — Configuration Files

Create every file below exactly as written.

### `tsconfig.json`

Overwrite the existing file:

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

Overwrite the existing file:

```json
{
  "extends": ["next/core-web-vitals", "plugin:@typescript-eslint/recommended"],
  "plugins": ["@typescript-eslint", "import"],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "no-console": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
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
import { resolve } from "path";
import { defineConfig } from "vitest/config";

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
        "src/app/**",
        "src/types/**",
        "**/*.config.*",
        "**/index.ts",
        "vitest.setup.ts",
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

### `lint-staged.config.mjs`

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

Make hooks executable:

```bash
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
```

### `package.json` — add scripts

Add these scripts to the `"scripts"` section in `package.json` (keep the existing ones):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "format": "prettier --write .",
    "db:types": "supabase gen types typescript --local > src/types/database.ts"
  }
}
```

### `tailwind.config.ts`

Overwrite the existing file:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0F0F13",
          card: "#17171F",
          border: "#1E1E2E",
          hover: "#21212E",
        },
        brand: {
          purple: "#7C3AED",
          "purple-light": "#A78BFA",
          "purple-dim": "#2D1F6E",
          teal: "#0D9488",
          "teal-light": "#5EEAD4",
          amber: "#D97706",
          "amber-light": "#FCD34D",
          red: "#DC2626",
          "red-light": "#FCA5A5",
        },
        text: {
          primary: "#F8FAFC",
          secondary: "#94A3B8",
          muted: "#475569",
          disabled: "#334155",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "8px",
      },
      keyframes: {
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200px 0" },
          to: { backgroundPosition: "calc(200px + 100%) 0" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.2s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
```

### `.env.local`

```bash
# Supabase — get these from your Supabase project dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# OpenRouter — get your key at openrouter.ai (free tier, no credit card)
OPENROUTER_API_KEY=your-openrouter-key-here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_FREE_MODEL=mistralai/mistral-7b-instruct:free
OPENROUTER_REPORT_MODEL=google/gemma-2-9b-it:free

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 4 — Supabase Migrations

Create these SQL files. Run them in your Supabase dashboard under SQL Editor, in order.

### `supabase/migrations/0001_initial_schema.sql`

```sql
-- Extensions
create extension if not exists "pgcrypto";

-- ─── ENUMS ───────────────────────────────────────────────────────────────────
create type task_status   as enum ('todo', 'in_progress', 'done', 'cancelled');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type task_source   as enum ('manual', 'ai_parsed', 'request_link');

-- ─── WORKSPACES ──────────────────────────────────────────────────────────────
create table workspaces (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  slug        text        not null unique,
  created_at  timestamptz not null default now()
);

-- ─── TASKS ───────────────────────────────────────────────────────────────────
create table tasks (
  id                 uuid          primary key default gen_random_uuid(),
  workspace_id       uuid          not null references workspaces(id) on delete cascade,
  title              text          not null,
  description        text,
  status             task_status   not null default 'todo',
  priority           task_priority not null default 'medium',
  tags               text[]        not null default '{}',
  due_date           date,
  estimated_minutes  integer,
  source             task_source   not null default 'manual',
  requested_by       text,
  carried_over       boolean       not null default false,
  carry_count        integer       not null default 0,
  status_history     jsonb         not null default '[]',
  completed_at       timestamptz,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);

create index tasks_workspace_status_idx  on tasks(workspace_id, status);
create index tasks_workspace_due_idx     on tasks(workspace_id, due_date);
create index tasks_workspace_created_idx on tasks(workspace_id, created_at);
create index tasks_workspace_source_idx  on tasks(workspace_id, source);

-- ─── DAILY LOGS ──────────────────────────────────────────────────────────────
create table daily_logs (
  id               uuid        primary key default gen_random_uuid(),
  workspace_id     uuid        not null references workspaces(id) on delete cascade,
  log_date         date        not null,
  completed_count  integer     not null default 0,
  created_count    integer     not null default 0,
  carried_count    integer     not null default 0,
  on_time_count    integer     not null default 0,
  unique(workspace_id, log_date)
);

-- ─── WEEKLY REPORTS ──────────────────────────────────────────────────────────
create table weekly_reports (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  week_start      date        not null,
  narrative       text        not null,
  stats           jsonb       not null default '{}',
  ethics_answers  jsonb,
  created_at      timestamptz not null default now(),
  unique(workspace_id, week_start)
);

-- ─── MONTHLY SUMMARIES ───────────────────────────────────────────────────────
create table monthly_summaries (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  year            integer     not null,
  month           integer     not null check (month between 1 and 12),
  narrative       text        not null,
  stats           jsonb       not null default '{}',
  top_categories  jsonb       not null default '[]',
  created_at      timestamptz not null default now(),
  unique(workspace_id, year, month)
);

-- ─── ETHICS QUESTIONS ────────────────────────────────────────────────────────
create table ethics_questions (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references workspaces(id) on delete cascade,
  question      text        not null,
  sort_order    integer     not null default 0,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
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

-- ─── STATUS HISTORY APPEND FUNCTION ─────────────────────────────────────────
create or replace function append_status_history(task_id uuid, entry jsonb)
returns jsonb language plpgsql as $$
declare
  current_history jsonb;
begin
  select status_history into current_history from tasks where id = task_id;
  return coalesce(current_history, '[]'::jsonb) || entry;
end;
$$;
```

### `supabase/migrations/0002_rls_policies.sql`

```sql
-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
alter table workspaces        enable row level security;
alter table tasks              enable row level security;
alter table daily_logs         enable row level security;
alter table weekly_reports     enable row level security;
alter table monthly_summaries  enable row level security;
alter table ethics_questions   enable row level security;

-- Workspaces: owner only
create policy "workspaces_owner_all"
  on workspaces for all
  using (auth.uid() = owner_id);

-- Tasks: workspace owner only
create policy "tasks_owner_all"
  on tasks for all
  using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

-- Daily logs: workspace owner only
create policy "daily_logs_owner_all"
  on daily_logs for all
  using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

-- Weekly reports: workspace owner only
create policy "weekly_reports_owner_all"
  on weekly_reports for all
  using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

-- Monthly summaries: workspace owner only
create policy "monthly_summaries_owner_all"
  on monthly_summaries for all
  using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

-- Ethics questions: workspace owner only
create policy "ethics_questions_owner_all"
  on ethics_questions for all
  using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );
```

### `supabase/migrations/0003_seed_ethics_questions.sql`

```sql
-- Default ethics questions inserted on workspace creation via trigger
-- This function is called from the app after workspace creation
-- Seeded here for reference only — app handles insertion
```

---

## Step 5 — Directory Structure

Create all directories:

```bash
mkdir -p src/app/\(auth\)/login
mkdir -p src/app/\(dashboard\)/board
mkdir -p src/app/\(dashboard\)/daily
mkdir -p src/app/\(dashboard\)/weekly
mkdir -p src/app/\(dashboard\)/monthly
mkdir -p src/app/\(dashboard\)/analytics
mkdir -p src/app/\(dashboard\)/reports
mkdir -p src/app/\(dashboard\)/ethics
mkdir -p src/app/\(dashboard\)/settings
mkdir -p "src/app/request/[slug]"
mkdir -p src/app/api/auth/callback
mkdir -p src/components/ui
mkdir -p src/components/layout
mkdir -p src/components/shared
mkdir -p src/features/tasks/__tests__
mkdir -p src/features/board/__tests__
mkdir -p src/features/daily/__tests__
mkdir -p src/features/weekly/__tests__
mkdir -p src/features/monthly/__tests__
mkdir -p src/features/analytics/__tests__
mkdir -p src/features/reports/__tests__
mkdir -p src/features/ethics/__tests__
mkdir -p src/features/request/__tests__
mkdir -p src/hooks
mkdir -p src/lib/supabase
mkdir -p src/types
mkdir -p supabase/migrations
```

---

## Step 6 — Core Library Files

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
  | { code: "RATE_LIMIT"; message: string }
  | { code: "CONFLICT"; message: string };
```

### `src/lib/result.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import { err, ok } from "./result";
import type { Result } from "./result";

describe("Result helpers", () => {
  it("ok wraps a value with ok: true", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it("err wraps an error with ok: false", () => {
    const result = err({ code: "NOT_FOUND" as const, message: "missing" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("Result type narrows correctly in if/else", () => {
    const maybeNumber: Result<number> = ok(10);
    let output = 0;
    if (maybeNumber.ok) {
      output = maybeNumber.value;
    }
    expect(output).toBe(10);
  });

  it("err preserves the full error shape", () => {
    const result = err({
      code: "VALIDATION_ERROR" as const,
      message: "bad input",
      fields: { title: ["required"] },
    });
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      if (result.error.code === "VALIDATION_ERROR") {
        expect(result.error.fields?.["title"]).toEqual(["required"]);
      }
    }
  });
});
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
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Only throw at runtime, not during type generation
  if (process.env["NODE_ENV"] !== "test") {
    throw new Error(
      `Invalid environment variables:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`,
    );
  }
}

export const env = parsed.success ? parsed.data : ({} as z.infer<typeof envSchema>);

export type Env = z.infer<typeof envSchema>;
```

### `src/lib/logger.ts`

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`;
  return entry.data ? `${base} ${JSON.stringify(entry.data)}` : base;
}

function log(level: LogLevel, message: string, data?: unknown): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  };

  const formatted = formatEntry(entry);

  // Use process.stdout/stderr directly to satisfy the no-console rule
  if (level === "error" || level === "warn") {
    process.stderr.write(formatted + "\n");
  } else {
    process.stdout.write(formatted + "\n");
  }
}

export const logger = {
  debug: (message: string, data?: unknown) => log("debug", message, data),
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
};
```

### `src/lib/logger.test.ts`

```typescript
import { describe, expect, it, vi } from "vitest";

import { logger } from "./logger";

describe("logger", () => {
  it("writes info to stdout", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logger.info("test message", { key: "value" });
    expect(spy).toHaveBeenCalledOnce();
    const output = spy.mock.calls[0]?.[0] as string;
    expect(output).toContain("INFO");
    expect(output).toContain("test message");
    spy.mockRestore();
  });

  it("writes error to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logger.error("something broke", { code: 500 });
    expect(spy).toHaveBeenCalledOnce();
    const output = spy.mock.calls[0]?.[0] as string;
    expect(output).toContain("ERROR");
    expect(output).toContain("something broke");
    spy.mockRestore();
  });

  it("writes warn to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logger.warn("heads up");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("omits data field when not provided", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logger.debug("no data");
    const output = spy.mock.calls[0]?.[0] as string;
    expect(output).not.toContain("undefined");
    spy.mockRestore();
  });
});
```

### `src/lib/cn.ts`

```typescript
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

### `src/lib/openrouter.ts`

```typescript
import OpenAI from "openai";

import { env } from "@/lib/env";

export const openrouter = new OpenAI({
  baseURL: env.OPENROUTER_BASE_URL,
  apiKey: env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
    "X-Title": "Productivity OS — Sperktar Lab",
  },
});
```

### `src/lib/date.ts`

```typescript
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from "date-fns";

export interface DateRange {
  start: Date;
  end: Date;
}

export function getWeekRange(date: Date): DateRange {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }), // Monday
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function getMonthRange(date: Date): DateRange {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

export function getMonthDays(date: Date): Date[] {
  const { start, end } = getMonthRange(date);
  return eachDayOfInterval({ start, end });
}

export function formatDate(date: Date, pattern: string = "yyyy-MM-dd"): string {
  return format(date, pattern);
}

export function formatDisplayDate(date: Date): string {
  return format(date, "d MMM yyyy");
}

export function formatMonthYear(date: Date): string {
  return format(date, "MMMM yyyy");
}

export function navigateMonth(date: Date, direction: "prev" | "next"): Date {
  return direction === "next" ? addMonths(date, 1) : subMonths(date, 1);
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
```

### `src/lib/date.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatMonthYear,
  getMonthDays,
  getMonthRange,
  getWeekRange,
  navigateMonth,
  toISODate,
} from "./date";

describe("date utilities", () => {
  const wednesday = new Date(2026, 5, 17); // Wednesday June 17 2026

  it("getWeekRange returns Monday to Sunday", () => {
    const { start, end } = getWeekRange(wednesday);
    expect(formatDate(start)).toBe("2026-06-15"); // Monday
    expect(formatDate(end)).toBe("2026-06-21"); // Sunday
  });

  it("getMonthRange returns first and last day", () => {
    const { start, end } = getMonthRange(wednesday);
    expect(formatDate(start)).toBe("2026-06-01");
    expect(formatDate(end)).toBe("2026-06-30");
  });

  it("getMonthDays returns all days in the month", () => {
    const days = getMonthDays(wednesday);
    expect(days).toHaveLength(30);
    expect(formatDate(days[0] as Date)).toBe("2026-06-01");
    expect(formatDate(days[29] as Date)).toBe("2026-06-30");
  });

  it("formatMonthYear formats correctly", () => {
    expect(formatMonthYear(wednesday)).toBe("June 2026");
  });

  it("navigateMonth moves forward and backward", () => {
    const next = navigateMonth(wednesday, "next");
    const prev = navigateMonth(wednesday, "prev");
    expect(formatDate(next, "yyyy-MM")).toBe("2026-07");
    expect(formatDate(prev, "yyyy-MM")).toBe("2026-05");
  });

  it("toISODate returns yyyy-MM-dd", () => {
    expect(toISODate(wednesday)).toBe("2026-06-17");
  });
});
```

---

## Step 7 — Supabase Client Files

### `src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";
import type { Database } from "@/types/database";

export function createClientSupabaseClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
```

### `src/lib/supabase/server.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import type { Database } from "@/types/database";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server component — cookie setting silently ignored
          }
        },
      },
    },
  );
}

export async function createAdminSupabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

### `src/lib/supabase/middleware.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login");
  const isPublicRoute =
    pathname.startsWith("/request/") ||
    pathname.startsWith("/api/request") ||
    pathname.startsWith("/api/auth");

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/board";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

---

## Step 8 — Types

### `src/types/database.ts`

```typescript
// This file will be overwritten by: pnpm db:types
// For now, define a minimal placeholder so the project compiles

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
      };
      tasks: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          description: string | null;
          status: "todo" | "in_progress" | "done" | "cancelled";
          priority: "low" | "medium" | "high" | "urgent";
          tags: string[];
          due_date: string | null;
          estimated_minutes: number | null;
          source: "manual" | "ai_parsed" | "request_link";
          requested_by: string | null;
          carried_over: boolean;
          carry_count: number;
          status_history: Json;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title: string;
          description?: string | null;
          status?: "todo" | "in_progress" | "done" | "cancelled";
          priority?: "low" | "medium" | "high" | "urgent";
          tags?: string[];
          due_date?: string | null;
          estimated_minutes?: number | null;
          source?: "manual" | "ai_parsed" | "request_link";
          requested_by?: string | null;
          carried_over?: boolean;
          carry_count?: number;
          status_history?: Json;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
      };
      daily_logs: {
        Row: {
          id: string;
          workspace_id: string;
          log_date: string;
          completed_count: number;
          created_count: number;
          carried_count: number;
          on_time_count: number;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          log_date: string;
          completed_count?: number;
          created_count?: number;
          carried_count?: number;
          on_time_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["daily_logs"]["Insert"]>;
      };
      weekly_reports: {
        Row: {
          id: string;
          workspace_id: string;
          week_start: string;
          narrative: string;
          stats: Json;
          ethics_answers: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          week_start: string;
          narrative: string;
          stats?: Json;
          ethics_answers?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_reports"]["Insert"]>;
      };
      monthly_summaries: {
        Row: {
          id: string;
          workspace_id: string;
          year: number;
          month: number;
          narrative: string;
          stats: Json;
          top_categories: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          year: number;
          month: number;
          narrative: string;
          stats?: Json;
          top_categories?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["monthly_summaries"]["Insert"]>;
      };
      ethics_questions: {
        Row: {
          id: string;
          workspace_id: string;
          question: string;
          sort_order: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          question: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ethics_questions"]["Insert"]>;
      };
    };
    Functions: {
      append_status_history: {
        Args: { task_id: string; entry: Json };
        Returns: Json;
      };
    };
    Enums: {
      task_status: "todo" | "in_progress" | "done" | "cancelled";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_source: "manual" | "ai_parsed" | "request_link";
    };
  };
}
```

### `src/types/api.ts`

```typescript
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

### `src/types/index.ts`

```typescript
export type { ApiResponse, ApiError, ApiSuccess } from "./api";
export type { Database } from "./database";
```

---

## Step 9 — Workspace Feature

### `src/features/workspace/types.ts`

```typescript
export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  createdAt: string;
}
```

### `src/features/workspace/actions.ts`

```typescript
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { err, ok } from "@/lib/result";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import type { Workspace } from "./types";

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

const DEFAULT_ETHICS_QUESTIONS = [
  "Did you protect deep work time today?",
  "Did you say yes to too many requests?",
  "Did you honor your stated priorities?",
  "Did you make progress on your most important goal?",
  "Did you maintain healthy boundaries between work and rest?",
];

export async function getOrCreateWorkspace(): Promise<Result<Workspace>> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const { data: existing } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (existing) {
    return ok({
      id: existing.id,
      ownerId: existing.owner_id,
      name: existing.name,
      slug: existing.slug,
      createdAt: existing.created_at,
    });
  }

  const name = user.user_metadata?.["full_name"] ?? user.email?.split("@")[0] ?? "My Workspace";

  const slug = generateSlug(name as string);

  const { data: created, error } = await supabase
    .from("workspaces")
    .insert({ owner_id: user.id, name: `${String(name)}'s Workspace`, slug })
    .select()
    .single();

  if (error ?? !created) {
    logger.error("Failed to create workspace", { error });
    return err({ code: "DB_ERROR", message: "Failed to create workspace", cause: error });
  }

  // Seed default ethics questions
  const questions = DEFAULT_ETHICS_QUESTIONS.map((question, i) => ({
    workspace_id: created.id,
    question,
    sort_order: i,
  }));

  await supabase.from("ethics_questions").insert(questions);

  logger.info("Workspace created", { workspaceId: created.id, slug });

  return ok({
    id: created.id,
    ownerId: created.owner_id,
    name: created.name,
    slug: created.slug,
    createdAt: created.created_at,
  });
}
```

### `src/features/workspace/index.ts`

```typescript
export { getOrCreateWorkspace } from "./actions";
export type { Workspace } from "./types";
```

---

## Step 10 — Shared UI Components

### `src/components/shared/LoadingSpinner.tsx`

```typescript
import { cn } from "@/lib/cn";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-spin rounded-full border-text-muted border-t-brand-purple",
        sizeMap[size],
        className,
      )}
    />
  );
}
```

### `src/components/shared/EmptyState.tsx`

```typescript
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-card border border-bg-border">
        <Icon className="h-6 w-6 text-text-muted" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

### `src/components/shared/PriorityBadge.tsx`

```typescript
import { cn } from "@/lib/cn";
import type { TaskPriority } from "@/features/tasks/types";

interface PriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

const priorityConfig: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  low: {
    label: "Low",
    className: "bg-bg-card text-text-muted border border-bg-border",
  },
  medium: {
    label: "Medium",
    className: "bg-bg-card text-text-secondary border border-bg-border",
  },
  high: {
    label: "High",
    className:
      "bg-amber-950/30 text-brand-amber-light border border-brand-amber/30",
  },
  urgent: {
    label: "Urgent",
    className: "bg-red-950/30 text-brand-red-light border border-brand-red/30",
  },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
```

### `src/components/shared/StatusBadge.tsx`

```typescript
import { cn } from "@/lib/cn";
import type { TaskStatus } from "@/features/tasks/types";

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  todo: {
    label: "To Do",
    className: "bg-bg-card text-text-secondary border border-bg-border",
  },
  in_progress: {
    label: "In Progress",
    className:
      "bg-purple-950/30 text-brand-purple-light border border-brand-purple/30",
  },
  done: {
    label: "Done",
    className:
      "bg-teal-950/30 text-brand-teal-light border border-brand-teal/30",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-bg-card text-text-disabled border border-bg-border",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
```

### `src/components/shared/index.ts`

```typescript
export { EmptyState } from "./EmptyState";
export { LoadingSpinner } from "./LoadingSpinner";
export { PriorityBadge } from "./PriorityBadge";
export { StatusBadge } from "./StatusBadge";
```

---

## Step 11 — Task Types (needed by shared components above)

### `src/features/tasks/types.ts`

```typescript
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskSource = "manual" | "ai_parsed" | "request_link";

export interface StatusHistoryEntry {
  status: TaskStatus;
  changedAt: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  dueDate: string | null;
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
  confidence: number;
}
```

### `src/features/tasks/index.ts`

```typescript
export type {
  Task,
  TaskInput,
  TaskPriority,
  TaskSource,
  TaskStatus,
  ParsedTaskResult,
  StatusHistoryEntry,
} from "./types";
```

---

## Step 12 — Layout Components

### `src/components/layout/Sidebar.tsx`

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  CalendarDays,
  CalendarRange,
  Calendar,
  BarChart2,
  FileText,
  Heart,
  Settings,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/cn";

const navItems = [
  { href: "/board",    icon: LayoutGrid,   label: "Board" },
  { href: "/daily",   icon: CalendarDays,  label: "Daily" },
  { href: "/weekly",  icon: CalendarRange, label: "Weekly" },
  { href: "/monthly", icon: Calendar,      label: "Monthly" },
  { href: "/analytics", icon: BarChart2,   label: "Analytics" },
  { href: "/reports", icon: FileText,      label: "Reports" },
  { href: "/ethics",  icon: Heart,         label: "Ethics" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-bg-card border-r border-bg-border">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-bg-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-purple">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-text-primary tracking-tight">
          Productivity OS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-brand-purple-dim text-brand-purple-light font-medium"
                  : "text-text-muted hover:bg-bg-hover hover:text-text-secondary",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="p-2 border-t border-bg-border">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-brand-purple-dim text-brand-purple-light font-medium"
              : "text-text-muted hover:bg-bg-hover hover:text-text-secondary",
          )}
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
```

### `src/components/layout/MobileNav.tsx`

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  CalendarDays,
  CalendarRange,
  Calendar,
  BarChart2,
} from "lucide-react";

import { cn } from "@/lib/cn";

const mobileNavItems = [
  { href: "/board",    icon: LayoutGrid,   label: "Board" },
  { href: "/daily",   icon: CalendarDays,  label: "Daily" },
  { href: "/weekly",  icon: CalendarRange, label: "Weekly" },
  { href: "/monthly", icon: Calendar,      label: "Monthly" },
  { href: "/analytics", icon: BarChart2,   label: "Stats" },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-bg-card border-t border-bg-border">
      <div className="flex items-center justify-around h-16 px-2">
        {mobileNavItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 flex-1 py-2 rounded-lg transition-colors",
                isActive ? "text-brand-purple-light" : "text-text-muted",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### `src/components/layout/TopBar.tsx`

```typescript
"use client";

import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";

import { createClientSupabaseClient } from "@/lib/supabase/client";

interface TopBarProps {
  userEmail?: string;
}

export function TopBar({ userEmail }: TopBarProps) {
  const router = useRouter();
  const supabase = createClientSupabaseClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-bg-border bg-bg-base md:bg-transparent">
      <div className="md:hidden flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-purple">
          <span className="text-white text-xs font-bold">P</span>
        </div>
        <span className="text-sm font-semibold text-text-primary">
          Productivity OS
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {userEmail && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:block">{userEmail}</span>
          </div>
        )}
        <button
          onClick={() => { void handleSignOut(); }}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </header>
  );
}
```

### `src/components/layout/index.ts`

```typescript
export { Sidebar } from "./Sidebar";
export { MobileNav } from "./MobileNav";
export { TopBar } from "./TopBar";
```

---

## Step 13 — Next.js App Files

### `src/middleware.ts`

```typescript
import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

### `src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: #0f0f13;
  color: #f8fafc;
  min-height: 100vh;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #1e1e2e;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #334155;
}

/* Focus ring */
:focus-visible {
  outline: 2px solid #7c3aed;
  outline-offset: 2px;
}

/* Skeleton shimmer */
.skeleton {
  background: linear-gradient(90deg, #17171f 25%, #1e1e2e 50%, #17171f 75%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
}
```

### `src/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Productivity OS",
  description: "AI-powered personal productivity system by Sperktar Lab",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
```

### `src/app/page.tsx`

```typescript
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/board");
}
```

### `src/app/(auth)/layout.tsx`

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-4">
      {children}
    </div>
  );
}
```

### `src/app/(auth)/login/page.tsx`

```typescript
import { LoginForm } from "@/features/auth/LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
```

### `src/app/(dashboard)/layout.tsx`

```typescript
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { TopBar } from "@/components/layout/TopBar";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/features/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Ensure workspace exists on every dashboard load
  await getOrCreateWorkspace();

  return (
    <div className="flex min-h-screen bg-bg-base">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar userEmail={user.email} />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
```

### `src/app/(dashboard)/board/page.tsx`

```typescript
export default function BoardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Board</h1>
      <p className="text-sm text-text-muted">
        Kanban view — built in Phase 2
      </p>
    </div>
  );
}
```

### `src/app/(dashboard)/daily/page.tsx`

```typescript
export default function DailyPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Daily</h1>
      <p className="text-sm text-text-muted">Daily view — built in Phase 2</p>
    </div>
  );
}
```

### `src/app/(dashboard)/weekly/page.tsx`

```typescript
export default function WeeklyPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Weekly</h1>
      <p className="text-sm text-text-muted">
        Weekly planner — built in Phase 2
      </p>
    </div>
  );
}
```

### `src/app/(dashboard)/monthly/page.tsx`

```typescript
export default function MonthlyPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Monthly</h1>
      <p className="text-sm text-text-muted">
        Monthly view — built in Phase 3
      </p>
    </div>
  );
}
```

### `src/app/(dashboard)/analytics/page.tsx`

```typescript
export default function AnalyticsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">
        Analytics
      </h1>
      <p className="text-sm text-text-muted">
        Performance dashboard — built in Phase 3
      </p>
    </div>
  );
}
```

### `src/app/(dashboard)/reports/page.tsx`

```typescript
export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Reports</h1>
      <p className="text-sm text-text-muted">
        Weekly and monthly reports — built in Phase 3
      </p>
    </div>
  );
}
```

### `src/app/(dashboard)/ethics/page.tsx`

```typescript
export default function EthicsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Ethics</h1>
      <p className="text-sm text-text-muted">
        Weekly reflection — built in Phase 4
      </p>
    </div>
  );
}
```

### `src/app/(dashboard)/settings/page.tsx`

```typescript
export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary mb-1">
        Settings
      </h1>
      <p className="text-sm text-text-muted">Workspace settings — built in Phase 4</p>
    </div>
  );
}
```

### `src/app/request/[slug]/page.tsx`

```typescript
export default function RequestPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">
            Submit a Request
          </h1>
          <p className="text-sm text-text-muted mt-2">
            Workspace: <span className="font-mono text-brand-purple-light">{params.slug}</span>
          </p>
        </div>
        <div className="bg-bg-card border border-bg-border rounded-xl p-6">
          <p className="text-sm text-text-muted text-center">
            Request form — built in Phase 2
          </p>
        </div>
      </div>
    </div>
  );
}
```

### `src/app/api/auth/callback/route.ts`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/board";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
```

---

## Step 14 — Auth Feature

### `src/features/auth/LoginForm.tsx`

```typescript
"use client";

import { useState } from "react";
import { Zap, Mail, Chrome } from "lucide-react";

import { createClientSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientSupabaseClient();

  async function handleMagicLink() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    const { error: supabaseError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    setLoading(false);
    if (supabaseError) {
      setError(supabaseError.message);
    } else {
      setSent(true);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);

    const { error: supabaseError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (supabaseError) {
      setLoading(false);
      setError(supabaseError.message);
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-bg-card border border-bg-border rounded-2xl p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-purple/10 border border-brand-purple/20 mx-auto mb-4">
            <Mail className="h-6 w-6 text-brand-purple-light" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Check your email
          </h2>
          <p className="text-sm text-text-muted">
            We sent a sign-in link to{" "}
            <span className="text-text-secondary font-medium">{email}</span>
          </p>
          <button
            onClick={() => { setSent(false); }}
            className="mt-6 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-purple mx-auto mb-4">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">
          Productivity OS
        </h1>
        <p className="text-sm text-text-muted mt-1">by Sperktar Lab</p>
      </div>

      <div className="bg-bg-card border border-bg-border rounded-2xl p-6 space-y-4">
        {/* Google OAuth */}
        <button
          onClick={() => { void handleGoogle(); }}
          disabled={loading}
          className={cn(
            "w-full flex items-center justify-center gap-2.5 rounded-xl",
            "bg-bg-hover border border-bg-border px-4 py-2.5",
            "text-sm font-medium text-text-primary",
            "hover:border-text-muted transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <Chrome className="h-4 w-4" />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-bg-border" />
          <span className="text-xs text-text-muted">or</span>
          <div className="flex-1 h-px bg-bg-border" />
        </div>

        {/* Magic link */}
        <div className="space-y-3">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleMagicLink();
              }}
              placeholder="you@example.com"
              className={cn(
                "w-full rounded-xl bg-bg-base border border-bg-border px-3 py-2.5",
                "text-sm text-text-primary placeholder:text-text-disabled",
                "focus:outline-none focus:border-brand-purple/50 transition-colors",
              )}
            />
          </div>

          {error && (
            <p className="text-xs text-brand-red-light">{error}</p>
          )}

          <button
            onClick={() => { void handleMagicLink(); }}
            disabled={loading || !email.trim()}
            className={cn(
              "w-full rounded-xl bg-brand-purple px-4 py-2.5",
              "text-sm font-medium text-white",
              "hover:bg-brand-purple/90 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {loading ? "Sending…" : "Send magic link"}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-text-muted mt-6">
        No account needed — your workspace is created automatically.
      </p>
    </div>
  );
}
```

### `src/features/auth/index.ts`

```typescript
export { LoginForm } from "./LoginForm";
```

---

## Step 15 — Enable Auth Providers in Supabase

In your Supabase dashboard:

1. Go to **Authentication → Providers**
2. Enable **Google** — add your Google OAuth Client ID and Secret from [console.cloud.google.com](https://console.cloud.google.com). Set authorised redirect URI to: `https://your-project.supabase.co/auth/v1/callback`
3. Enable **Email** (magic link) — this is on by default

---

## Step 16 — Verification

Run all four commands. Every one must exit 0.

```bash
# 1. Type check — zero errors
pnpm typecheck

# 2. Lint — zero warnings
pnpm lint

# 3. Tests — all pass, ≥ 90% coverage on lib files
pnpm test

# 4. Build — compiles cleanly
pnpm build
```

Then start the dev server and verify the app loads:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You should be redirected to `/login`. The login page renders with the Productivity OS logo, Google button, and magic link input. After signing in, the dashboard shell loads with the sidebar (desktop) or bottom nav (mobile) and the placeholder page content.

---

## Expected Verification Output

```
# pnpm typecheck
✓ 0 errors

# pnpm lint
✓ 0 warnings, 0 errors

# pnpm test
✓ result.test.ts        4 tests passed
✓ logger.test.ts        4 tests passed
✓ date.test.ts          6 tests passed
Coverage: lines 94%, functions 96%, branches 91%

# pnpm build
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
Route (app)              Size
├ / (redirect)
├ /login
├ /board
├ /daily
├ /weekly
├ /monthly
├ /analytics
├ /reports
├ /ethics
├ /settings
└ /request/[slug]
```

---

## Phase 1 Complete

When all 4 verification commands exit 0 and the app loads in the browser, Phase 1 is done.

**What exists now:**

- Full project config (TypeScript strict, ESLint zero-warning, Prettier, Vitest ≥90%, Husky hooks)
- Supabase schema with all 6 tables, RLS policies, and triggers
- Auth working (Google OAuth + magic link)
- Workspace auto-created and ethics questions seeded on first login
- Dashboard shell (sidebar + bottom mobile nav + top bar) fully responsive
- All routes scaffolded and accessible
- Core lib files fully tested

**Do not proceed to Phase 2 until all 4 verification commands pass.**

Phase 2 covers: AI task parser, Kanban board with drag-and-drop, Daily view with carryover detection, Weekly planner, and the Request Link public form.
