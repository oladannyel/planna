# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **The request-link cap is now atomic.** It counted `tasks` rows and then
  inserted, with nothing serialising the two, so submissions issued together
  all read a count below the limit and a burst of N parallel requests spent N
  model calls against a cap of 20. Slots are now claimed with a single
  `insert ... on conflict do update ... returning` against a counter table
  (migration `0007_request_throttle.sql`), so concurrent callers serialise on
  a row lock. Fails closed — a deployment missing 0007 refuses submissions
  rather than running uncapped.

- **A second cap, per client address**, claimed _before_ the workspace slug is
  looked up. An unknown slug used to be answered before anything was counted,
  which made the 404 a free existence oracle over every workspace in a
  deployment. Ten an hour, against 20 per workspace.

- **A strict Content Security Policy with a per-request nonce**, plus HSTS,
  `X-Frame-Options`, `Referrer-Policy`, a closed `Permissions-Policy` and
  `Cross-Origin-Opener-Policy`. There were previously no security headers at
  all. Applied to redirects as well as pages. `'strict-dynamic'` means an
  injected same-origin `<script src>` fails too. The cost: reading the nonce
  makes every route server-rendered, so `/login` is no longer static.

- **The logger redacts secrets.** SECURITY.md promised the service-role key
  never reaches a log line; nothing enforced it, and the objects the logger is
  handed are upstream errors, which like to carry the request that failed.
  Secret-named keys and secret-shaped values are now stripped recursively,
  cycle-safe, before anything is written.

- **Constant-time comparison of `CRON_SECRET`**, which was `!==` and so leaked
  the length of a matching prefix to anyone able to time the responses. It is
  also now part of the Zod environment schema, which is the convention the
  project documents and this was the one variable breaking.

- **Every GitHub Action pinned to a commit SHA.** A tag is a pointer its owner
  can repoint at any time, at which point the workflow runs whatever that
  account pushes next, with this repository's token.

### Added

- **Model failover.** `AI_MODEL_FALLBACKS` takes a comma-separated chain of
  models to try, in order, when the configured one fails in a way another
  model could fix: retired (404), daily cap reached (429), or backend unwell
  (408/5xx). A rejected key (401) and a malformed request (400) are never
  retried, because every model in the chain shares the one key and the one
  request body, so a second attempt is a guaranteed second failure.

  Failover happens per request, so a model retired overnight costs nothing and
  needs no redeploy. It is also why the daily health check still only
  _reports_ a dead model rather than rewriting configuration — an unattended
  cron that redeploys production is a worse failure than the one it fixes. The
  check now probes the fallbacks too, since those are exactly the models
  nobody notices breaking.

  Empty by default: answering with a model you did not choose should be
  something you opted into.

## [1.1.0] — 2026-11-09

### Added

- **Provider-neutral model configuration.** `AI_BASE_URL`, `AI_API_KEY`,
  `AI_MODEL` and `AI_REPORT_MODEL` point plAnna at any OpenAI-compatible
  provider — OpenRouter, OpenAI, Groq, Together, or a local Ollama server. The
  previous `OPENROUTER_*` names are still accepted, so upgrading breaks nothing.
- **Daily model health check** at `/api/cron/ai-health`, run by Vercel Cron. It
  separates the three upstream failures that look identical from inside the
  app: a revoked key (401), a retired model (404), and a busy free pool (429).
  Authenticated with `CRON_SECRET`, and refuses to run without it.

### Changed

- **Next.js 16 and React 19.** Clears all 36 dependency advisories (3 critical,
  17 high), none of which had a fix available on Next 14. Migrates the async
  Request APIs, renames `middleware` to `proxy`, and drops the `NEXT_DIST_DIR`
  workaround now that `next dev` has its own output directory.
- **ESLint flat config** on ESLint 9, ahead of ESLint 10 dropping legacy config.
- **A much richer seed.** A fresh `supabase db reset` now produces twelve tasks
  spread over three weeks across all four statuses, so the board, analytics and
  monthly views all have something to show on first run.

### Security

- **Request links are rate limited.** The public `/api/request` endpoint is
  unauthenticated by design and runs a language-model call per submission, so
  anyone holding a workspace slug could spend the owner's AI quota and fill
  their board. Each workspace now accepts 20 request-link submissions per
  hour, checked before the model call. The HTTP endpoint answers `429` with
  `Retry-After`.
- **Upgraded `zod` to 4.6.7**, patching a high-severity memory-exhaustion
  advisory that applied to validating oversized constrained collections —
  reachable from that same unauthenticated endpoint.

### Fixed

- **The task sheet could not be closed from a keyboard.** Its dismiss backdrop
  was a `div` with an `onClick`, and there was no Escape handler. The backdrop
  is now a real button, and Escape closes the sheet.
- **Hydration mismatch on every board render.** `@dnd-kit` derives its
  accessibility ids from a counter that restarts between server and client, so
  every card hydrated with an `aria-describedby` pointing at an element absent
  from the server HTML. `DndContext` now has an explicit id.
- **`CardTitle` spread its children instead of rendering them**, so a caller
  that omitted children produced a silently empty heading.
- **A column holding one task announced "1 tasks"** to screen readers.
- **A throttled or unknown request link no longer reports as a form error.**
  "Please check the form and try again" sent submitters to re-read input that
  was fine.
- **New tasks appear on the board without a reload.** `useTasks` seeded its
  state from the server once and ignored every later update, and its realtime
  subscription never opened on an empty board because it inferred the workspace
  from a task row that did not exist yet.
- **Upstream AI failures are no longer reported as parse failures.** A revoked
  key surfaced to the user as "Couldn't parse that — try adding manually",
  blaming their input for a credentials fault.
- **Scheduled jobs are not redirected to the login page.** The session gate
  treated cron requests as logged-out visitors and answered 307, which a cron
  runner reads as success.

## [1.0.0] — 2026-11-05

First public release. plAnna has been in daily personal use before this point;
this release is the open-sourcing of it.

### Added

- **Natural-language task capture.** A chat box that turns one sentence into
  structured tasks with titles, priorities, tags, effort estimates and deadlines.
- **Kanban board** with drag-and-drop across `todo`, `in progress`, `done` and
  `cancelled`, plus per-status archive views.
- **Daily and weekly planning** views, with automatic carry-over flagging so
  slipped work stays visible.
- **Analytics** — time and attention by project and tag, and on-time completion
  rates measured against real deadlines.
- **Monthly and AI-generated reports** built from your own task history.
- **Ethics check-in** with a configurable reflection question set.
- **Public request links** at `/request/[slug]`, letting colleagues file a task
  into a workspace without an account.
- **Google OAuth** via Supabase Auth, with Row Level Security on every table.
- **324 tests** across 49 files, spanning unit, component and integration levels.
- Repository hygiene for public release: MIT license, CI across typecheck, lint,
  test and build, contribution and security policies, issue and pull request
  templates, and Dependabot.

[1.0.0]: https://github.com/oladannyel/planna/releases/tag/v1.0.0
