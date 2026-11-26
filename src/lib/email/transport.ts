import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Why a send failed, in the only terms the caller acts on.
 *
 * `retryable` is the whole point: a 429 or a 502 is a row that should sit in
 * the outbox and be tried again, and a 422 "that address is not valid" is a
 * row that will fail identically forever. Retrying the second one costs quota
 * and hides the real problem behind an attempt counter that never stops.
 */
export interface SendFailure {
  message: string;
  retryable: boolean;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

/** True when mail can actually leave the machine. */
export function emailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/**
 * Send one email.
 *
 * With no `RESEND_API_KEY` this logs what it would have sent and reports a
 * *retryable* failure — not a success. Pretending an unsent mail was
 * delivered would mark the outbox row `sent`, and the moment a key is
 * configured the backlog would be silently gone. A pending row is the honest
 * record of "we meant to send this and could not".
 */
export async function sendEmail(
  message: OutboundEmail,
): Promise<Result<{ id: string }, SendFailure>> {
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey) {
    // The body is deliberately not logged: it carries a colleague's text and,
    // in the owner's case, their own address. Subject and recipient are
    // enough to see that the path ran.
    logger.warn("Email not sent: RESEND_API_KEY is not configured", {
      subject: message.subject,
    });
    return err({ message: "RESEND_API_KEY is not configured", retryable: true });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return err({
        message: `Resend responded ${response.status}: ${detail.slice(0, 300)}`,
        // 408/429 and anything 5xx are the provider's problem and pass; the
        // rest are ours and will not improve on a second attempt.
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      });
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return ok({ id: body.id ?? "" });
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === "AbortError";
    return err({
      message: aborted ? `Resend timed out after ${SEND_TIMEOUT_MS}ms` : String(cause),
      retryable: true,
    });
  } finally {
    clearTimeout(timeout);
  }
}
