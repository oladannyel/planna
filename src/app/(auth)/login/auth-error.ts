/**
 * Turn a failed sign-in round-trip into something a person can act on.
 *
 * Supabase reports magic-link failures in the URL *fragment*, which never
 * reaches the server — so `/auth/callback` sees no `code`, assumes the worst
 * and redirects to `?error=missing_code`. The browser carries the fragment
 * along, which is why a failure arrives as both a vague query parameter and
 * an accurate hash:
 *
 *   /login?error=missing_code#error=access_denied&error_code=otp_expired
 *
 * The hash is the real reason and wins. Without this the page rendered an
 * empty form and said nothing at all, which reads as "sign-in is broken"
 * rather than "that link expired, ask for another".
 */

const MESSAGES: Record<string, string> = {
  otp_expired:
    "That sign-in link has expired or was already used. Links are single-use — request a fresh one below.",
  access_denied: "That sign-in link is no longer valid. Request a fresh one below.",
  exchange_failed:
    "We could not finish signing you in. Open the link in the same browser you requested it from — the security check is stored there.",
  missing_code: "That sign-in link did not carry a login code. Request a fresh one below.",
};

const FALLBACK = "Something went wrong signing you in. Request a fresh link below.";

/** Reads `?a=b` or `#a=b` into a map; tolerates a leading `?`/`#` or neither. */
function params(raw: string): URLSearchParams {
  return new URLSearchParams(raw.replace(/^[?#]/, ""));
}

/**
 * The message to show, or null when this is an ordinary visit.
 *
 * `search` and `hash` are passed in rather than read from `window` so this is
 * testable as the pure mapping it is.
 */
export function readAuthError(search: string, hash: string): string | null {
  const fromHash = params(hash);
  const fromQuery = params(search);

  // Most specific first: Supabase's own code, then its generic error, then
  // whatever our callback guessed.
  const code =
    fromHash.get("error_code") ?? fromHash.get("error") ?? fromQuery.get("error") ?? null;

  if (!code) return null;

  const known = MESSAGES[code];
  if (known) return known;

  // An unmapped code still beats silence, and Supabase's own wording is
  // usually serviceable.
  const described = fromHash.get("error_description");
  return described ? described.replace(/\+/g, " ") : FALLBACK;
}
