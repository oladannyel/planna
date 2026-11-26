import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

/**
 * The slice of the Gmail API this feature uses. Hand-rolled over `fetch`
 * rather than `googleapis`: three endpoints, against a 40 MB dependency that
 * would also pull in a whole auth stack we are not using.
 *
 * Every call has a timeout. One hung request must not hold the cron open
 * until the platform kills it mid-ingest.
 */

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const TIMEOUT_MS = 15_000;

async function call<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Result<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return err({
        code: "UNAUTHORIZED",
        message: `Gmail refused the request (${response.status})`,
      });
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return err({
        code: "DB_ERROR",
        message: `Gmail ${response.status}: ${detail.slice(0, 200)}`,
      });
    }

    return ok((await response.json()) as T);
  } catch (cause) {
    return err({ code: "DB_ERROR", message: `Gmail request failed: ${String(cause)}` });
  } finally {
    clearTimeout(timeout);
  }
}

/** The address of the connected mailbox, for the settings screen. */
export async function mailboxAddress(accessToken: string): Promise<Result<string>> {
  const result = await call<{ emailAddress?: string }>("/profile", accessToken);
  if (!result.ok) return result;
  if (!result.value.emailAddress) {
    return err({ code: "DB_ERROR", message: "Gmail returned no address for the mailbox" });
  }
  return ok(result.value.emailAddress);
}

export async function listMessageIds(
  accessToken: string,
  query: string,
  max = 25,
): Promise<Result<string[]>> {
  const params = new URLSearchParams({ q: query, maxResults: String(max) });
  const result = await call<{ messages?: { id: string }[] }>(
    `/messages?${params.toString()}`,
    accessToken,
  );
  if (!result.ok) return result;
  return ok((result.value.messages ?? []).map((message) => message.id));
}

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  body: string;
  receivedAt: string | null;
}

interface RawPart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: RawPart[];
}

interface RawMessage {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: RawPart & { headers?: { name: string; value: string }[] };
}

function header(message: RawMessage, name: string): string {
  const found = message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value ?? "";
}

/**
 * The plain-text body, depth-first.
 *
 * A Gmail message is a tree: `multipart/alternative` holding a text part and
 * an HTML part, often nested inside `multipart/mixed` for attachments. Taking
 * the first `text/plain` found is what a mail client does, and it avoids
 * feeding a wall of HTML to the parser. When there is no text part at all,
 * the snippet is a short, already-stripped summary — better than nothing and
 * better than tag soup.
 */
export function extractPlainText(message: RawMessage): string {
  function walk(part: RawPart | undefined): string | null {
    if (!part) return null;
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64url").toString("utf8");
    }
    for (const child of part.parts ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }

  const text = walk(message.payload);
  if (text) return text.trim();

  // A single-part text message puts the body on the payload itself. Only
  // when it really is text: an HTML-only message would otherwise reach the
  // parser as tag soup, where the snippet Gmail already stripped is better.
  const topLevel = message.payload?.mimeType ?? "text/plain";
  if (message.payload?.body?.data && topLevel.startsWith("text/plain")) {
    return Buffer.from(message.payload.body.data, "base64url").toString("utf8").trim();
  }

  return (message.snippet ?? "").trim();
}

export async function getMessage(
  accessToken: string,
  messageId: string,
): Promise<Result<GmailMessage>> {
  const result = await call<RawMessage>(`/messages/${messageId}?format=full`, accessToken);
  if (!result.ok) return result;

  const raw = result.value;
  const internal = Number(raw.internalDate);

  return ok({
    id: raw.id,
    subject: header(raw, "Subject"),
    from: header(raw, "From"),
    body: extractPlainText(raw),
    receivedAt: Number.isFinite(internal) ? new Date(internal).toISOString() : null,
  });
}

/** The labels on the account, by name, so a query's label can be removed. */
export async function labelIdByName(
  accessToken: string,
  name: string,
): Promise<Result<string | null>> {
  const result = await call<{ labels?: { id: string; name: string }[] }>("/labels", accessToken);
  if (!result.ok) return result;

  const match = (result.value.labels ?? []).find(
    (label) => label.name.toLowerCase() === name.toLowerCase(),
  );
  return ok(match?.id ?? null);
}

/** Mark a message handled: drop the watched label, and drop UNREAD with it. */
export async function markHandled(
  accessToken: string,
  messageId: string,
  labelIds: string[],
): Promise<Result<null>> {
  const removeLabelIds = [...new Set([...labelIds, "UNREAD"])];
  const result = await call<unknown>(`/messages/${messageId}/modify`, accessToken, {
    method: "POST",
    body: JSON.stringify({ removeLabelIds }),
  });
  return result.ok ? ok(null) : result;
}

/** The label name a query watches, when it names one. `label:plAnna` → plAnna. */
export function labelFromQuery(query: string): string | null {
  const match = /(?:^|\s)label:("[^"]+"|\S+)/i.exec(query);
  if (!match?.[1]) return null;
  return match[1].replace(/^"|"$/g, "");
}
