## What this changes

<!-- One or two sentences. What is different after this merges? -->

## Why

<!-- The problem being solved. Link the issue if there is one: Closes #123 -->

## How

<!-- Notable implementation decisions, trade-offs, or anything a reviewer would otherwise have to reverse-engineer. -->

## Quality gates

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes with zero warnings
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes

## Checklist

- [ ] New or changed behaviour is covered by tests
- [ ] New environment variables are added to both `src/lib/env.ts` and `.env.local.example`
- [ ] Any new database table ships with Row Level Security policies in the same migration
- [ ] Migrations are new numbered files; no shipped migration was edited
- [ ] No secrets, keys or real task content in the diff
- [ ] Docs updated if behaviour or setup changed

## Screenshots

<!-- For UI changes. Delete if not applicable. -->
