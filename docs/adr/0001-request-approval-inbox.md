# ADR 0001: Requests land in an inbox, not on the board

- Status: accepted
- Date: 2026-11-26
- Phase: R (request inbox and notifications)

## Context

A request link (`/request/<slug>`) lets anyone holding the slug file work into the
owner's workspace. Until now `ingestRequest` inserted a `tasks` row directly, with
`source = 'request_link'` and `status = 'todo'`. Three consequences followed:

1. **The board was writable by strangers.** Anyone with the link added a card to the
   owner's plan. There was no accept step, so "someone asked" and "I agreed to do it"
   were the same event in the data.
2. **Every submission spent a model call.** The AI parse ran at submit time, before
   anyone had decided the work was real. That is the expensive half of any abuse of the
   endpoint, and it was reachable by an unauthenticated caller.
3. **The requester learned nothing.** No acknowledgement, no status, no outcome. The
   colleague who filed the request had to ask the owner in person what happened to it.

Analytics also counted un-triaged requests as planned work, so `source = 'request_link'`
tasks inflated throughput and on-time denominators with work the owner never accepted.

## Decision

A request is its own record with its own lifecycle, separate from the task it may become.

- New table `requests`: the submission, its requester, its state
  (`pending | accepted | rejected`), the task it produced (nullable) and a random
  `token` that addresses its public status page.
- `ingestRequest` inserts a `requests` row. It does **not** create a task and does
  **not** call the model.
- Accepting runs the parser, creates the task (`source = 'request_link'`,
  `requested_by` = requester name) and links `requests.task_id`.
- Rejecting records the state and an optional reason. No task is ever created.
- The owner is told in-app (a `notifications` row, surfaced by the bell in the top bar)
  and by email.
- The requester is told by email at each transition — accepted, rejected, in progress,
  done, cancelled — and can read the same timeline at `/request/status/<token>`
  without an account.

Status changes on a linked task propagate to the requester, so `updateTaskStatus` is the
single point where a task transition becomes a requester notification.

## Consequences

- **The board only holds work the owner accepted.** Analytics stop counting un-triaged
  requests; no metric change is needed, the rows simply are not there until accepted.
- **The model call moves behind authentication.** An unauthenticated caller can spend a
  row, not a model call. The existing two-layer throttle (per address, per workspace)
  still applies and now guards something cheaper.
- **A migration is required** (`0008`), and the existing public API contract gains
  fields (`requestId`, `statusUrl`) without losing any. Existing `request_link` tasks are
  left alone: they predate the inbox and have no request row. The status page 404s for
  them, which is correct — there is no request to show.
- **The requester's email address is new personal data.** It is optional, used only to
  send that request's own status mail, never exposed to anyone but the workspace owner,
  and deleted with the request.
- One more unauthenticated surface exists: the status page. It is addressed by a
  128-bit token, returns only that request's own fields, and is rate limited by the
  same address bucket as submission.

## Alternatives considered

- **A `pending` task status.** Fewer tables, but it puts un-agreed work in the same
  place as the plan and every query in the app would need to learn to exclude it.
  Forgetting one is a silent leak of strangers' text into the owner's day.
- **Keep creating tasks, add an `approved` boolean.** Same objection, plus the AI call
  stays in front of the auth boundary.
- **Tell the requester nothing; let them ask.** This is the current behaviour and it is
  the reason the feature was asked for.
