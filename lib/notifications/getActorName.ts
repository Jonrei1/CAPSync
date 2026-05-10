import type { SupabaseClient } from "@supabase/supabase-js";

export async function getActorName(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();

  if (error || !data) {
    return "Someone";
  }

  return data.full_name?.trim() || data.email?.split("@")[0] || "Someone";
}