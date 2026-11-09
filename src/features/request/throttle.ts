import { createHmac } from "node:crypto";

import { env } from "@/lib/env";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * How many request-link tasks one workspace will accept per hour.
 *
 * Request links are unauthenticated by design: anyone holding the slug can
 * file a task. That makes this the only path where a stranger can cause the
 * workspace owner to spend money — each submission runs a language-model call
 * — and fill their board. Generous enough that a real team never notices it.
 */
export const REQUEST_HOURLY_LIMIT = 20;

/**
 * How many submissions one client address may make per hour, across every
 * workspace and including attempts at slugs that do not exist.
 *
 * The workspace cap alone left two holes. A stranger with one valid slug could
 * still spend the full 20 model calls an hour by themselves, and — because an
 * unknown slug used to be answered before anything was counted — anyone could
 * probe slugs indefinitely and read existence off the status code. Claiming an
 * address slot *before* the slug is looked up turns that oracle into ten
 * guesses an hour.
 *
 * Lower than the workspace cap on purpose: a team filing requests is several
 * people at several addresses, so the per-address share of a workspace's quota
 * should be smaller than the whole.
 */
export const REQUEST_IP_HOURLY_LIMIT = 10;

/**
 * Stable, non-reversible key for a client address.
 *
 * The throttle needs to recognise a repeat caller, which does not require
 * storing where they are. An HMAC keyed by a server-only secret gives that:
 * the digest is stable for as long as the key is, and IPv4's 32-bit space —
 * brute-forceable in seconds against a bare SHA-256 — is useless without the
 * key. The service-role key is reused as the HMAC key because it is already
 * required, already server-only and already never logged; rotating it resets
 * every live counter, which is a one-hour loss of throttle state and is worth
 * noting but not worth a second secret to avoid.
 */
export function addressKey(address: string): string {
  return createHmac("sha256", env.SUPABASE_SERVICE_ROLE_KEY)
    .update(address.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

/**
 * Best-effort client address for a request.
 *
 * `x-forwarded-for` is a client-supplied header everywhere except behind a
 * proxy that overwrites it, which is what Vercel does. The *left-most* entry
 * is the one a hostile client controls; the right-most entries are appended by
 * infrastructure. Vercel also sets `x-real-ip` to the value it trusts, so that
 * is preferred where present.
 *
 * Returns null when nothing usable is present, and callers treat that as one
 * shared bucket rather than as "unthrottled" — an attacker who could strip the
 * header should not thereby escape the cap.
 */
export function clientAddress(headers: Headers): string | null {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;

  const first = forwarded.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

/**
 * Claim one slot in a throttle bucket, atomically.
 *
 * Delegates to `claim_request_slot` (migration 0007), which increments and
 * tests the counter in a single statement so concurrent callers serialise on
 * the row lock instead of all reading the same stale count.
 *
 * Fails closed. If the function is missing — a deployment that has not applied
 * 0007 — the error surfaces as a `DB_ERROR` and the submission is refused,
 * rather than quietly reverting to no limit on the one path that spends money.
 */
export async function claimSlot(
  admin: AdminClient,
  bucket: string,
  limit: number,
): Promise<Result<{ allowed: boolean }>> {
  const { data, error } = await admin.rpc("claim_request_slot", {
    p_bucket: bucket,
    p_limit: limit,
  });

  if (error) {
    return err({
      code: "DB_ERROR",
      message: `Throttle check failed: ${error.message}`,
      cause: error,
    });
  }

  // A null return would mean the function answered neither yes nor no. Treat
  // it as a refusal for the same reason as above.
  return ok({ allowed: data === true });
}
