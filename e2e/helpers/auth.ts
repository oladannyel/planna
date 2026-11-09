import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * The seeded demo account (supabase/seed.sql). It exists only in the local
 * stack, and `supabase db reset` recreates it.
 */
export const DEMO_EMAIL = "demo@planna.local";

/** Mailpit, the local stack's mail catcher. Supabase CLI puts it on 54424. */
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54424";

interface MailpitMessage {
  ID: string;
}

/**
 * Sign in by magic link, the way a real user does.
 *
 * Google OAuth cannot be driven from a test — it is a third party's login
 * page, and automating someone's Google account is both brittle and wrong.
 * The magic link exercises the same `/auth/callback` exchange: the comment on
 * `signInWithGoogle` notes that Google hands back the same `?code=`, so the
 * one callback serves both and this covers the path that matters.
 *
 * Deleting the mailbox first means the link found afterwards is certainly the
 * one this call triggered, rather than a stale one from an earlier test that
 * would send the browser into an already-consumed token.
 */
export async function signIn(page: Page, email: string = DEMO_EMAIL): Promise<void> {
  await clearMailbox();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();

  // The app confirms before the mail arrives; waiting on this first gives a
  // clearer failure when it is the sign-in call that broke rather than the inbox.
  await expect(page.getByText(`Check ${email} for your sign-in link.`)).toBeVisible();

  const link = await waitForMagicLink();

  /*
   * The link starts a chain: Supabase's /auth/v1/verify, then the app's
   * /auth/callback, which exchanges the code, bootstraps the workspace and
   * redirects again. Returning while any of that is still in flight makes the
   * caller's next navigation abort with ERR_ABORTED — a confusing failure
   * that looks like a broken page rather than a race. Wait for the whole
   * chain to settle.
   */
  await page.goto(link, { waitUntil: "networkidle" });

  await expect(page).not.toHaveURL(/\/login/);
  await page.waitForLoadState("networkidle");
}

async function clearMailbox(): Promise<void> {
  const response = await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(
      `Could not clear Mailpit at ${MAILPIT} (${response.status}). Is the local Supabase stack running? See e2e/README.md`,
    );
  }
}

/**
 * Poll Mailpit for the sign-in mail and pull the link out of it.
 *
 * Polling rather than a fixed wait: mail delivery is fast but not
 * instantaneous, and a sleep long enough to be safe is a sleep paid on every
 * run.
 */
async function waitForMagicLink(timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const listed = await fetch(`${MAILPIT}/api/v1/messages`);
    if (listed.ok) {
      const body = (await listed.json()) as { messages?: MailpitMessage[] };
      const id = body.messages?.[0]?.ID;

      if (id) {
        const message = await fetch(`${MAILPIT}/api/v1/message/${id}`);
        const detail = (await message.json()) as { Text?: string; HTML?: string };
        const link = extractLink(`${detail.HTML ?? ""}\n${detail.Text ?? ""}`);
        if (link) return link;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`No sign-in link arrived at Mailpit (${MAILPIT}) within ${timeoutMs}ms.`);
}

/**
 * Supabase sends a `/auth/v1/verify` URL on the API origin, which redirects to
 * the app's callback. Taking the first such URL and decoding entities is
 * enough; the HTML body wraps it in an anchor, the text body does not.
 */
function extractLink(body: string): string | null {
  const match = body.match(/https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/);
  if (!match) return null;
  return match[0].replace(/&amp;/g, "&");
}
