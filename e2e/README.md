# End-to-end tests

Playwright specs that drive a real browser against a production build and the
local Supabase stack.

## Why these exist

The unit suite deliberately excludes the board's drag views, the Supabase
client glue and the realtime wiring, because each needs a real browser or a
real backend. That was a sound reason not to unit-test them and a poor reason
to leave them untested — drag-and-drop, the auth round trip and persistence
across a reload are the three things most likely to break for someone cloning
this repo, and they had no test at all.

They also cover things only a rendered page can show: that the Content
Security Policy is actually served and never violated, and that the pages pass
an axe accessibility scan in both themes.

## Running them

```bash
supabase start      # first run pulls container images
supabase db reset   # replay migrations and reseed the demo workspace
pnpm test:e2e       # or pnpm test:e2e:ui for the Playwright UI
```

`supabase db reset` matters: the specs sign in as the seeded `demo@planna.local`
account and the board specs move seeded tasks, so a run leaves the board in a
different state than it found it. Reset before a run you intend to trust.

## How sign-in works

Google OAuth cannot be driven from a test — it is a third party's login page,
and automating a real Google account is both brittle and wrong. The specs use
the magic-link flow instead: request a link, read it out of Mailpit (the local
stack's mail catcher, on `54424`), and follow it. That exercises the same
`/auth/callback` code exchange Google uses, so the path that matters is
covered either way.

## Things that will bite you

- **The port is 3100, spelled `localhost`.** Supabase refuses a magic-link
  `redirect_to` that is not allow-listed and bounces to `site_url` instead,
  which lands the browser back on `/login` looking exactly like a failed
  sign-in. `supabase/config.toml` already allow-lists
  `http://localhost:3100/auth/callback`.

- **The server is never reused.** `reuseExistingServer` is `false` even
  locally. With a server already on the port, Playwright silently attaches to
  it and every spec then tests the build from _before_ your change — failures
  look like application bugs and a correct fix looks like it did not work.

- **Keyboard drag needs the lift to settle.** dnd-kit attaches its key
  listener a tick after the Space that starts the drag. An arrow key sent in
  that gap reaches nobody, and the drop reports the original column. See
  `lift()` in `board.spec.ts`.

- **Wait for the write, not for the network.** `commitDrop` fires the server
  action without awaiting it, so the board moves the card optimistically while
  the write is in flight. `networkidle` can settle before the action's POST is
  even issued; the board spec waits on the response itself.

## Known accessibility defects

`accessibility.spec.ts` disables exactly two axe rules, both for real defects
that should be fixed rather than tolerated — `nested-interactive` and
`label-content-name-mismatch`. The reasoning and the suggested fix for each is
in the comment beside `KNOWN_DEFECTS`. Every other rule, `color-contrast`
included, fails the run.
