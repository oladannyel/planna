# Security Policy

## Supported versions

plAnna is a self-hosted application. There are no released binaries and no backported patches — the `main` branch is the supported version. If you run a fork, pull from `main` to receive fixes.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/oladannyel/planna/security) of this repository.
2. Click **Report a vulnerability**.
3. Describe the issue, the impact, and how to reproduce it.

This creates a private advisory visible only to the maintainers.

### What to expect

| Stage                  | Target                              |
| ---------------------- | ----------------------------------- |
| Acknowledgement        | Within 5 working days               |
| Initial assessment     | Within 10 working days              |
| Fix or mitigation plan | Communicated in the advisory thread |

This is a side project maintained by one person, so these are good-faith targets rather than a commercial SLA.

### Please do

- Give us a reasonable window to fix the issue before disclosing it publicly.
- Test only against your own instance. Never against someone else's deployment.
- Report in good faith; we will credit you in the advisory unless you prefer otherwise.

## Scope

In scope: anything in this repository — the application code, the SQL migrations and the Row Level Security policies, the authentication flow, and the public request-link endpoint.

Out of scope: vulnerabilities in Supabase, Vercel, OpenRouter or other third-party services (report those to the vendor), and findings that require a misconfigured self-hosted instance rather than a flaw in this code.

## Operator responsibilities

If you deploy plAnna, these are yours to get right:

- **Never commit `.env.local`.** It is gitignored; keep it that way.
- **`SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security.** It is a server-only secret. It must never reach the browser, a `NEXT_PUBLIC_` variable, or a log line.
- **Apply every migration, in order.** Skipping `0002_rls_policies.sql` leaves tables without Row Level Security and your data readable across accounts. Skipping `0007_request_throttle.sql` leaves the public request endpoint with no working rate limit — it fails closed and refuses every submission rather than running uncapped, so you will notice, but you will notice as an outage.
- **Lock your OAuth redirect URLs** to the domains you actually use.
- **Treat request-link slugs as unlisted, not secret.** Anyone holding the link can file a task into that workspace by design.
- **Set `CRON_SECRET`** in any environment where the scheduled job runs. Without it `/api/cron/ai-health` refuses to serve, which is deliberate: an open cron route is an open quota drain.
- **Rotate your OpenRouter key** if it is ever exposed in a log or a screenshot. The logger redacts secret-shaped values as a backstop, but it is a backstop, not a licence to log one.
