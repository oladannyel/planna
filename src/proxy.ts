import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Renamed from `middleware` in Next 16: the convention is now `proxy`, which
 * runs on the Node.js runtime. plAnna never used the edge runtime here — it
 * refreshes the Supabase session cookie and gates private routes — so the
 * rename is behaviour-preserving.
 */
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every request except static assets and image optimisation files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
