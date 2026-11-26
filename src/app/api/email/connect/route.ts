import { NextResponse } from "next/server";

import { STATE_COOKIE, consentUrl, encodeState, oauthConfigured } from "@/features/email-intake";
import { publicOrigin } from "@/features/request/link";
import { getAuthedContext } from "@/features/workspace/queries";
import { env } from "@/lib/env";
import { sealingConfigured } from "@/lib/sealed";

/** The consent round trip must not be cached or prerendered. */
export const dynamic = "force-dynamic";

/**
 * Start the Gmail connect flow.
 *
 * Authenticated: the state names a workspace, and only its owner may put a
 * mailbox on it. Refuses before redirecting when the deployment cannot
 * actually store a token — an owner who completes Google's consent screen and
 * then learns the key was missing has granted access for nothing.
 */
export async function GET(): Promise<NextResponse> {
  const ctx = await getAuthedContext();
  if (!ctx.ok) {
    return NextResponse.redirect(new URL("/login", env.NEXT_PUBLIC_APP_URL));
  }

  const origin = await publicOrigin();

  if (!oauthConfigured()) {
    return NextResponse.redirect(`${origin}/settings/email?error=oauth_not_configured`);
  }
  if (!sealingConfigured()) {
    return NextResponse.redirect(`${origin}/settings/email?error=key_missing`);
  }

  const { state, nonce } = encodeState(ctx.value.workspaceId);

  const response = NextResponse.redirect(consentUrl(origin, state));
  // The nonce is half of the state check: the signature proves we issued it,
  // and the cookie proves it came back to the browser that started the flow.
  response.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: !origin.startsWith("http://"),
    path: "/api/email",
    maxAge: 600,
  });
  return response;
}
