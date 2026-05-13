import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityType = "meeting" | "deadline" | "schedule" | "task";

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
  eventEndHour?: number;
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
    event_end_hour: input.eventEndHour ?? null,
    link: input.link,
    created_by_name: input.createdByName,
    read_at: null,
  }));

  const insertWithEndHour = await input.supabase.from("activity_notifications").insert(rows);

  if (insertWithEndHour.error) {
    const message = insertWithEndHour.error.message.toLowerCase();

    if (message.includes("event_end_hour") && message.includes("schema cache")) {
      const rowsWithoutEndHour = rows.map((row) => ({
        user_id: row.user_id,
        group_id: row.group_id,
        group_name: row.group_name,
        group_color: row.group_color,
        type: row.type,
        title: row.title,
        event_date: row.event_date,
        event_start_hour: row.event_start_hour,
        link: row.link,
        created_by_name: row.created_by_name,
        read_at: row.read_at,
      }));
      const retry = await input.supabase.from("activity_notifications").insert(rowsWithoutEndHour);

      if (retry.error) {
        const retryMessage = retry.error.message.toLowerCase();

        if (
          retryMessage.includes("could not find the table") ||
          retryMessage.includes("row-level security") ||
          retryMessage.includes("permission denied")
        ) {
          return;
        }

        console.error("[writeActivityNotification] insert failed:", retry.error.message);
        return;
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("activity-notifications:refresh"));
      }

      return;
    }

    if (
      message.includes("could not find the table") ||
      message.includes("row-level security") ||
      message.includes("permission denied")
    ) {
      return;
    }

    console.error("[writeActivityNotification] insert failed:", insertWithEndHour.error.message);
    return;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("activity-notifications:refresh"));
  }
}