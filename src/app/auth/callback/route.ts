import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ensureWorkspace } from "@/features/workspace";
import { logger } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * OAuth / magic-link callback. Exchanges the auth code for a session, ensures
 * the user's workspace exists, then redirects into the app.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logger.error("Auth code exchange failed", { message: error.message });
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const workspace = await ensureWorkspace();
  if (!workspace.ok) {
    logger.error("Workspace bootstrap failed after login", { error: workspace.error });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
