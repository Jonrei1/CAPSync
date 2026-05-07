import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityType = "meeting" | "deadline" | "schedule";

export type WriteActivityNotificationInput = {
  supabase: SupabaseClient;
  recipientIds: string[];
  groupId?: string | null;
  groupName?: string | null;
  groupColor?: string | null;
  type: ActivityType;
  title: string;
  eventDate: string;
  eventStartHour?: number;
  link: string;
  createdByName: string;
};

export async function writeActivityNotification(input: WriteActivityNotificationInput): Promise<void> {
  if (input.recipientIds.length === 0) {
    return;
  }

  const rows = input.recipientIds.map((userId) => ({
    user_id: userId,
    group_id: input.groupId ?? null,
    group_name: input.groupName ?? null,
    group_color: input.groupColor ?? null,
    type: input.type,
    title: input.title,
    event_date: input.eventDate,
    event_start_hour: input.eventStartHour ?? null,
    link: input.link,
    created_by_name: input.createdByName,
    read_at: null,
  }));

  const { error } = await input.supabase.from("activity_notifications").insert(rows);

  if (error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("could not find the table") ||
      message.includes("row-level security") ||
      message.includes("permission denied")
    ) {
      return;
    }

    console.error("[writeActivityNotification] insert failed:", error.message);
    return;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("activity-notifications:refresh"));
  }
}