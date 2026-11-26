# ADR 0002: Email intake polls Gmail over OAuth

- Status: accepted
- Date: 2026-11-26
- Phase: G (email task intake)

## Context

plAnna should turn an email into a task: forward or label a message, and the work shows
up on the board with the existing parser's title, priority, tags and deadline. Two
mechanisms can deliver that.

**Inbound address.** A per-workspace address (`tasks+<slug>@example.com`) behind an
inbound-email provider that POSTs each message to a webhook. It is push, so it is
instant, and it needs no access to anyone's mailbox. It also needs a domain, MX records,
an inbound provider account, and signature verification on a new unauthenticated webhook
that accepts arbitrary attacker-supplied content.

**Gmail polling.** The owner connects their Google account; a scheduled job lists
messages matching a query (default `label:plAnna`), turns each new one into a task, and
marks it processed. It needs an OAuth client — which this deployment already has — and
no DNS at all.

## Decision

Poll Gmail over OAuth, on the existing cron schedule.

- One connection per workspace, stored in `email_connections`, holding the Google
  refresh token **encrypted at rest** (AES-256-GCM, key from `EMAIL_TOKEN_KEY`).
- Scope: `gmail.modify` — read the matching messages and remove the label once they
  are ingested. Not `mail.google.com`, which would also permit deletion.
- The query is the owner's, defaulting to `label:plAnna`. Nothing outside the label is
  ever read.
- Every ingested message id is recorded in `email_ingest_log`, unique per workspace, so
  a re-run of the poll cannot create the task twice. The label removal is best effort;
  the log is the idempotency key, not the label.
- New task source `email`, so the board can show where a task came from and analytics
  can tell it apart from a manual one.

## Consequences

- **No DNS, no inbound provider, no new public webhook.** The only new unauthenticated
  surface is the cron route, which already has a `CRON_SECRET` pattern to copy.
- **Latency is the poll interval**, not seconds. Email-to-task is not interactive work;
  an hourly poll is honest about what it is.
- **A refresh token for a personal mailbox now exists in the database.** It is encrypted
  with a key held only in the environment, never logged, never returned to the client,
  and revocable from the settings page and from the Google account page. If
  `EMAIL_TOKEN_KEY` is absent the connect flow refuses to start rather than storing a
  token in the clear.
- **Google verification applies** if this is ever used by people outside the developer's
  own account: `gmail.modify` is a restricted scope. For a self-hosted single-owner
  deployment the owner is the publisher and their own test user.
- Message bodies are sent to the configured model, exactly as typed task text already is.
  The README must say so.

## Alternatives considered

- **Inbound address via provider webhook** — rejected above on setup cost and on adding
  an unauthenticated ingestion endpoint.
- **IMAP with an app password** — works with any provider and needs no OAuth client, but
  a stored password grants the whole mailbox forever, and Google has withdrawn app
  passwords for most accounts.
- **Gmail push via Pub/Sub watch** — lower latency, but it needs a Google Cloud project,
  a Pub/Sub topic and a renewal job for the 7-day watch expiry. Worth revisiting only if
  the poll interval becomes the complaint.
