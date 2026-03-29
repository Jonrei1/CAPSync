import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@/types";

// Ensures the signed-in user's profile row exists.
// If the row is missing, this upserts it using auth metadata/email.
export async function ensureProfile(
  supabase: SupabaseClient,
  authUser: SupabaseUser,
): Promise<{ profile: User | null; error: string | null }> {
  const payload: User = {
    id: authUser.id,
    full_name:
      (authUser.user_metadata?.full_name as string | undefined) ??
      (authUser.user_metadata?.name as string | undefined) ??
      null,
    email: authUser.email ?? null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("id, full_name, email, created_at")
    .single();

  if (error) {
    return { profile: null, error: error.message };
  }

  return { profile: data as User, error: null };
}
