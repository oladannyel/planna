import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
