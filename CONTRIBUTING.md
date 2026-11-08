# Contributing to plAnna

Thanks for your interest. plAnna is a personal productivity tool released so that anyone can clone it and bend it to their own way of working — forks are as welcome as pull requests.

## Ways to contribute

- **Fork it and change it.** The most expected use of this repo. No permission needed; that is what the MIT license is for.
- **Report a bug.** Open an issue using the bug template.
- **Propose a feature.** Open an issue first so we can agree the shape before you write code.
- **Improve the docs.** Small, always welcome.

For security problems, follow [SECURITY.md](SECURITY.md) instead of opening an issue.

## Development setup

See [Quick start](README.md#quick-start) in the README. You need a Supabase project and an OpenRouter key; both have free tiers sufficient for development.

## The quality gates

Four gates. All four must be green before a pull request can merge, and CI runs every one of them on every push:

```bash
pnpm typecheck     # tsc --noEmit, strict mode
pnpm lint          # eslint, --max-warnings 0
pnpm test          # vitest with coverage
pnpm build:check   # next build, into its own directory
```

Use `build:check`, not `build`, while a dev server is running. The two share
`.next` by default, and a build run alongside `next dev` leaves the dev server
serving HTML where its stylesheet should be — the app renders completely
unstyled with no error reported anywhere. `build:check` builds into
`.next-build` instead, so it cannot interfere.

Run them locally before you push. A Husky pre-commit hook runs lint-staged on staged files, but it is a convenience, not a substitute.

## Conventions

These are the conventions the existing code follows. Matching them keeps review short.

**Feature slices.** Code lives in `src/features/<domain>/`, not in layered folders. A slice contains:

| File         | Responsibility                        |
| ------------ | ------------------------------------- |
| `schema.ts`  | Zod schemas — the validation boundary |
| `queries.ts` | Reads                                 |
| `actions.ts` | Server Actions (mutations)            |
| `mappers.ts` | Database row ↔ domain object          |
| `types.ts`   | Domain types                          |
| `index.ts`   | The slice's public surface            |
| `__tests__/` | Tests, colocated                      |

**Server Actions over API routes.** Mutations are Server Actions. Add a route handler only when something outside the app must call in.

**Validate at the boundary.** Every input from a user, a request link or a language model goes through a Zod schema before it reaches business logic.

**Return `Result`, don't throw.** Fallible operations return the `Result` type from `src/lib/result.ts`. Failure belongs in the type signature.

**Security lives in the database.** Any new table needs Row Level Security policies in the same migration. Do not rely on the application layer alone.

**Environment variables are typed.** Add new ones to the Zod schema in `src/lib/env.ts` _and_ to `.env.local.example` with a comment on where the value comes from. Never hardcode a model name, URL or key.

**Imports use `@/`.** No deep relative chains.

**Don't re-export through barrels on hot paths.** A barrel re-export has bitten this codebase's bundle size before; import directly in performance-sensitive code.

## Database migrations

Migrations are ordered SQL files in `supabase/migrations/`, numbered sequentially (`0006_...`). They are append-only — never edit one that has shipped. Write them to be idempotent (`if not exists`) where you reasonably can, and include RLS policies for anything new.

## Tests

The suite is 483 tests across 61 files, and new work is expected to keep it that way or better. Test behaviour, not implementation detail. Language-model calls are mocked — never let a test hit a live model or a real database.

## Pull requests

1. Branch from `main`, named `feat/...`, `fix/...`, `docs/...` or `chore/...`.
2. Keep it focused. One concern per pull request.
3. Write a commit message that says what changed and why.
4. Run the four gates.
5. Fill in the pull request template.

Review looks for: does it work, is it tested, does it match the conventions above, and does it keep failure explicit.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be decent to people.
