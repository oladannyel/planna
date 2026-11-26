import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  STATE_COOKIE,
  decodeState,
  exchangeCode,
  mailboxAddress,
  storeConnection,
} from "@/features/email-intake";
import { publicOrigin } from "@/features/request/link";
import { getAuthedContext } from "@/features/workspace/queries";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function back(origin: string, params: Record<string, string>): NextResponse {
  const query = new URLSearchParams(params).toString();
  const response = NextResponse.redirect(`${origin}/settings/email?${query}`);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

/**
 * Finish the Gmail connect flow.
 *
 * Four things are checked before a token is stored, and the order matters:
 * the signed state (we issued it, recently), the nonce cookie (this browser
 * started it), the session (someone is signed in), and that the signed-in
 * workspace is the one named in the state. The last is the one that stops a
 * state captured from another user's flow being completed here.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = await publicOrigin();
  const params = request.nextUrl.searchParams;

  const denied = params.get("error");
  if (denied) return back(origin, { error: "denied" });

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return back(origin, { error: "incomplete" });

  const decoded = decodeState(state);
  if (!decoded) return back(origin, { error: "bad_state" });

  const nonce = request.cookies.get(STATE_COOKIE)?.value;
  if (!nonce || nonce !== decoded.nonce) return back(origin, { error: "bad_state" });

  const ctx = await getAuthedContext();
  if (!ctx.ok || ctx.value.workspaceId !== decoded.workspaceId) {
    return back(origin, { error: "not_your_workspace" });
  }

  const tokens = await exchangeCode(code, origin);
  if (!tokens.ok) {
    logger.warn("Gmail code exchange failed", { reason: tokens.error.message });
    return back(origin, { error: "exchange_failed" });
  }
  if (!tokens.value.refreshToken) {
    // Google issues a refresh token only when it decides to. Without one the
    // poll has nothing to authenticate with, so this is a failure, not a
    // partial success to paper over.
    return back(origin, { error: "no_refresh_token" });
  }

  const address = await mailboxAddress(tokens.value.accessToken);
  if (!address.ok) return back(origin, { error: "profile_failed" });

  const stored = await storeConnection({
    workspaceId: decoded.workspaceId,
    emailAddress: address.value,
    refreshToken: tokens.value.refreshToken,
  });
  if (!stored.ok) {
    logger.error("Could not store the mailbox connection", { reason: stored.error.message });
    return back(origin, { error: "store_failed" });
  }

  return back(origin, { connected: "1" });
}
