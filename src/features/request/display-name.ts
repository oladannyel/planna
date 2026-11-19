"use server";

import { revalidatePath } from "next/cache";

import { err, ok } from "@/lib/result";
import type { Result } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_LENGTH = 60;

/**
 * Set the name the public request form greets submitters with.
 *
 * Stored on the auth user rather than in a new table column: it is one string
 * about one person, and every schema change in this project has to be applied
 * to production by hand.
 */
export async function setRequestDisplayName(name: string): Promise<Result<{ name: string }>> {
  const trimmed = name.trim().slice(0, MAX_LENGTH);
  if (trimmed.length === 0) {
    return err({ code: "VALIDATION_ERROR", message: "Enter the name requesters should see." });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const { error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
  if (error) {
    return err({ code: "DB_ERROR", message: error.message });
  }

  revalidatePath("/board");
  return ok({ name: trimmed });
}
