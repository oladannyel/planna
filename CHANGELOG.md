# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
