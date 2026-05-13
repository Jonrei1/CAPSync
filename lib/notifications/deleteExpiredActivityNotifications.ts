import type { SupabaseClient } from "@supabase/supabase-js";

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

export async function deleteExpiredActivityNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - SEVEN_DAYS_IN_MS).toISOString();

  const { error } = await supabase
    .from("activity_notifications")
    .delete()
    .eq("user_id", userId)
    .lt("created_at", cutoff);

  if (error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("could not find the table") ||
      message.includes("row-level security") ||
      message.includes("permission denied")
    ) {
      return;
    }

    console.error("[deleteExpiredActivityNotifications] delete failed:", error.message);
  }
}
