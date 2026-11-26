export {
  GMAIL_SCOPE,
  consentUrl,
  decodeState,
  encodeState,
  exchangeCode,
  oauthConfigured,
  refreshAccessToken,
  revokeToken,
  callbackUrl,
  STATE_TTL_MS,
} from "./oauth";
export { mailboxAddress, labelFromQuery } from "./gmail";
export { getEmailConnection, storeConnection } from "./connection";
export type { EmailConnection } from "./connection";
export { disconnectEmail, updateEmailQuery } from "./actions";
export { pollAllMailboxes, pollConnection, messageToPrompt, POLL_BATCH } from "./ingest";
export type { PollSummary } from "./ingest";
export { EmailConnectionCard } from "./EmailConnectionCard";
export { CONNECT_ERRORS, connectErrorMessage } from "./connect-errors";

/** The cookie holding the OAuth nonce for the length of the consent trip. */
export const STATE_COOKIE = "planna_email_oauth";
