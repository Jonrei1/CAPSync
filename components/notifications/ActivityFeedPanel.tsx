"use client";

import { useRouter } from "next/navigation";
import { Calendar, CalendarPlus, Flag, X } from "lucide-react";
import { designTokens } from "@/components/ui/design-standard";
import type { ActivityNotification } from "@/hooks/useActivityNotifications";

type Props = {
  open: boolean;
  onClose: () => void;
  notifications: ActivityNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
};

type Tone = {
  accent: string;
  icon: typeof Calendar;
};

function getTone(type: ActivityNotification["type"]): Tone {
  switch (type) {
    case "meeting":
      return { accent: designTokens.palette.app.brandPrimary, icon: CalendarPlus };
    case "deadline":
      return { accent: designTokens.palette.app.status.danger, icon: Flag };
    case "schedule":
      return { accent: designTokens.palette.app.brandAccent, icon: Calendar };
  }
}

function formatEventTime(notification: ActivityNotification): string {
  if (!notification.eventDate) {
    return "";
  }

  const date = new Date(`${notification.eventDate}T12:00:00`);
  const dateText = date.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (notification.eventStartHour == null) {
    return dateText;
  }

  const hours = Math.floor(notification.eventStartHour);
  const minutes = Math.round((notification.eventStartHour - hours) * 60);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;

  return `${dateText} · ${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function timeAgo(createdAt: string): string {
  const difference = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(difference / 60_000);

  if (minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}

export default function ActivityFeedPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  const router = useRouter();

  if (!open) {
    return null;
  }

  async function handleRowClick(notification: ActivityNotification) {
    if (!notification.readAt) {
      await onMarkRead(notification.id);
    }

    onClose();
    router.push(notification.link);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed inset-y-0 left-0 z-60 flex w-full flex-col border-r border-border/70 bg-white shadow-2xl md:left-55 md:w-72"
        role="dialog"
        aria-modal="true"
        aria-label="Activity feed"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900">Activity</span>
            {unreadCount > 0 ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold leading-none text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void onMarkAllRead()}
                className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-900"
              >
                Mark all read
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Close activity panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-[12px] text-zinc-500">No activity yet</div>
          ) : (
            notifications.map((notification) => {
              const tone = getTone(notification.type);
              const isUnread = !notification.readAt;

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleRowClick(notification)}
                  className={[
                    "flex w-full items-start gap-3 border-b border-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-50",
                    isUnread ? "bg-zinc-50/60" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      isUnread ? "bg-indigo-600" : "bg-transparent",
                    ].join(" ")}
                  />

                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-white"
                    style={{ backgroundColor: tone.accent }}
                    aria-hidden="true"
                  >
                    <tone.icon className="h-3.5 w-3.5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-zinc-900">{notification.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: notification.groupColor }}
                      />
                      <span className="truncate">{notification.groupName}</span>
                      {notification.eventDate ? (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="truncate">{formatEventTime(notification)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <span className="shrink-0 text-[10px] text-zinc-400">{timeAgo(notification.createdAt)}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}