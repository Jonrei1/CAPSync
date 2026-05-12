import type { ActivityNotification } from "@/hooks/useActivityNotifications";

export function getNotificationHref(notification: ActivityNotification): string {
  if (notification.type === "meeting" && notification.groupId && notification.eventDate) {
    const params = new URLSearchParams({ date: notification.eventDate });

    if (notification.eventStartHour != null) {
      params.set("start", String(notification.eventStartHour));
    }

    if (notification.eventEndHour != null) {
      params.set("end", String(notification.eventEndHour));
    }

    return `/${notification.groupId}/calendar?${params.toString()}`;
  }

  return notification.link;
}