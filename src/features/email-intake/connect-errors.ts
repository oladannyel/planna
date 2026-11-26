/**
 * What each failure of the connect flow means, in the owner's terms.
 *
 * A plain module, not part of the card component: the settings page is a
 * server component, and a value exported from a `"use client"` file reaches
 * the server as a client reference rather than as the object — the lookup
 * then silently misses and every failure reads "Connecting the mailbox
 * failed", which is exactly the message that helps nobody. Found by clicking
 * Connect with no key configured.
 */
export const CONNECT_ERRORS: Record<string, string> = {
  denied: "Google consent was cancelled, so nothing was connected.",
  incomplete: "Google did not send back enough to finish connecting.",
  bad_state: "That connect link had expired. Start again from this page.",
  not_your_workspace: "That connect link was for a different account.",
  exchange_failed: "Google would not exchange the code. Try again.",
  no_refresh_token:
    "Google did not issue a refresh token. Remove plAnna from your Google account's third-party access and connect again.",
  profile_failed: "Connected, but Gmail would not say which address it was. Try again.",
  store_failed: "Could not save the connection. Try again.",
  oauth_not_configured: "This deployment has no Google OAuth client configured.",
  key_missing: "EMAIL_TOKEN_KEY is not set, so a mailbox token cannot be stored safely.",
};

/** The message for a code the flow came back with. */
export function connectErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return CONNECT_ERRORS[code] ?? "Connecting the mailbox failed.";
}
