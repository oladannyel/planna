# plAnna

**A to-do list that talks back.** Write one sentence about your day, and plAnna turns it into a tracked board, then tells you where your time actually went.

[![CI](https://github.com/oladannyel/planna/actions/workflows/ci.yml/badge.svg)](https://github.com/oladannyel/planna/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org)

---

## Why this exists

Most productivity tools make you do data entry before they give you anything back. plAnna inverts that: you write a sentence, it does the structuring, and the payoff is a record honest enough to judge your own performance against — which projects got your attention, which quietly starved, and what the fine detail of the work actually was.

It was built for one person's daily work across many parallel projects. It generalises to anyone who needs to track work daily and keep the details that usually get lost.

## What it does

| Capability                   | What it means in practice                                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Natural-language capture** | Type _"ship the pricing API, review Tunde's PR, draft the Q3 deck"_ into a chat box. plAnna parses it into separate tasks with titles, priorities, tags, effort estimates and deadlines. |
| **Kanban board**             | Drag tasks across `todo → in progress → done`, with a `cancelled` lane and per-status archives.                                                                                          |
| **Daily & weekly planning**  | A daily focus view, a week planner, and automatic carry-over flagging so slipped work stays visible instead of vanishing.                                                                |
| **Analytics**                | Where time went by project and tag, attention distribution, and honest on-time completion rates measured against real deadlines.                                                         |
| **Monthly & AI reports**     | Generated narrative summaries of a period's work, built from your own task history.                                                                                                      |
| **Ethics check-in**          | A configurable reflection prompt set — the part of the tool that asks questions back.                                                                                                    |
| **Request links**            | A public `/request/[slug]` link so colleagues can file a task into your board without an account.                                                                                        |

## Tech stack

- **[Next.js 14](https://nextjs.org)** (App Router, Server Actions, React Server Components)
- **TypeScript** in strict mode
- **[Supabase](https://supabase.com)** — Postgres, Auth (Google OAuth), and Row Level Security on every table
- **[Tailwind CSS](https://tailwindcss.com)** + **[Radix UI](https://www.radix-ui.com)** primitives
- **[OpenRouter](https://openrouter.ai)** for language-model calls (configured for free-tier models)
- **[Vitest](https://vitest.dev)** + Testing Library + MSW — 324 tests
- **[Recharts](https://recharts.org)** for analytics, **[dnd-kit](https://dndkit.com)** for the board

## Quick start

### Prerequisites

- **Node.js 20+** (developed on 24 LTS)
- **pnpm 9+** — `npm i -g pnpm`
- A free **[Supabase](https://supabase.com)** project
- A free **[OpenRouter](https://openrouter.ai)** API key

### 1. Clone and install

```bash
git clone https://github.com/oladannyel/planna.git
cd planna
pnpm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in the values — see [`.env.local.example`](.env.local.example) for where each one comes from.

### 3. Set up the database

Run the migrations in [`supabase/migrations/`](supabase/migrations) **in order** against your Supabase project, either through the Supabase SQL editor or the Supabase CLI:

```bash
supabase db push
```

They create the schema, enable Row Level Security, and add the monthly-summary, ethics and deadline features.

### 4. Enable Google OAuth

In your Supabase dashboard, under **Authentication → Providers → Google**, enable the provider and add your redirect URL:

```
http://localhost:3000/auth/callback
```

### 5. Run it

```bash
pnpm dev
```

Open <http://localhost:3000>.

## Development

| Command           | What it does                    |
| ----------------- | ------------------------------- |
| `pnpm dev`        | Start the dev server            |
| `pnpm build`      | Production build                |
| `pnpm typecheck`  | `tsc --noEmit`, strict          |
| `pnpm lint`       | ESLint, zero warnings tolerated |
| `pnpm test`       | Full suite with coverage        |
| `pnpm test:watch` | Tests in watch mode             |
| `pnpm format`     | Prettier across the repo        |

All four gates — typecheck, lint, test, build — must pass before anything merges. A Husky pre-commit hook runs lint-staged locally, and [CI](.github/workflows/ci.yml) enforces the same on every push and pull request.

## Project structure

```
src/
├── app/                  # Next.js App Router
│   ├── (auth)/           # Login
│   ├── (dashboard)/      # Board, daily, weekly, analytics, monthly, reports, ethics
│   ├── api/              # Route handlers
│   ├── auth/             # OAuth callback and signout
│   └── request/[slug]/   # Public task-request links
├── components/           # ui/ primitives, layout/, shared/
├── features/             # Vertical slices, one folder per domain
│   ├── tasks/            # Capture, parsing, task CRUD
│   ├── board/            # Kanban
│   ├── daily/ weekly/    # Planning views
│   ├── analytics/        # Metrics and charts
│   ├── monthly/ reports/ # Generated summaries
│   ├── ethics/           # Reflection check-ins
│   ├── request/          # Inbound request links
│   └── workspace/        # Workspace and slug handling
├── hooks/                # Shared React hooks
├── lib/                  # env, logger, result, date, cn, supabase clients
└── types/                # Shared types
supabase/migrations/      # Ordered SQL migrations
```

Each `features/*` folder follows the same shape: `schema.ts` (Zod), `queries.ts` (reads), `actions.ts` (Server Actions), `mappers.ts` (DB ↔ domain), components, and `__tests__/`.

## Architecture notes

- **Server Actions over API routes.** Mutations are Server Actions, validated with Zod at the boundary. The only route handler is the public request endpoint.
- **Results, not thrown errors.** Fallible operations return a `Result` type (`src/lib/result.ts`) so failure is part of the signature.
- **Security in the database.** Row Level Security policies in [`0002_rls_policies.sql`](supabase/migrations/0002_rls_policies.sql) are the authority on who can read what — the app layer is not the only gate.
- **Validated environment.** `src/lib/env.ts` parses every variable through Zod at startup, so a misconfiguration fails loudly and immediately.
- **Free-tier language models.** Model names are environment variables, not hardcoded, because free-tier model availability changes often. See [`.env.local.example`](.env.local.example).

## Deployment

Deploys to [Vercel](https://vercel.com) with no extra configuration. Set the same environment variables in your project settings, and point `NEXT_PUBLIC_APP_URL` and your Supabase OAuth redirect at the deployed domain.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and the quality gates. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

To report a security issue, please follow [SECURITY.md](SECURITY.md) rather than opening a public issue.

## License

[MIT](LICENSE) © Daniel Olaniyan — use it, fork it, change it to fit how you work.
