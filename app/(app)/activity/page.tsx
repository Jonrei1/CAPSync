"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CalendarPlus, CheckSquare2, Clock3, Flag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { designStandard, designTokens } from "@/components/ui/design-standard";
import { cn } from "@/lib/utils";
import type { ActivityNotification } from "@/hooks/useActivityNotifications";
import { useActivityNotifications } from "@/hooks/useActivityNotifications";

type Tone = {
  accent: string;
  background: string;
  icon: typeof Calendar;
};

function getTone(type: ActivityNotification["type"]): Tone {
  switch (type) {
    case "meeting":
      return { accent: designTokens.palette.app.brandPrimary, background: "#4f46e51a", icon: CalendarPlus };
    case "deadline":
      return { accent: designTokens.palette.app.status.danger, background: "#dc26261a", icon: Flag };
    case "schedule":
      return { accent: designTokens.palette.app.brandAccent, background: "#16a34a1a", icon: Calendar };
    case "task":
      return { accent: "#ca8a04", background: "#ca8a041a", icon: CheckSquare2 };
  }
}

function formatClock(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const wholeHour = Math.floor(normalized);
  const minutes = Math.round((normalized - wholeHour) * 60);
  const suffix = wholeHour >= 12 ? "PM" : "AM";
  const displayHour = wholeHour > 12 ? wholeHour - 12 : wholeHour === 0 ? 12 : wholeHour;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function buildDateTime(date: string, hour: number): Date {
  const next = new Date(`${date}T00:00:00`);
  const wholeHour = Math.floor(hour);
  const minutes = Math.round((hour - wholeHour) * 60);
  next.setHours(wholeHour, minutes, 0, 0);
  return next;
}

function formatRelativeTime(target: Date, now: Date): string {
  const diff = target.getTime() - now.getTime();
  const absMinutes = Math.round(Math.abs(diff) / 60_000);

  if (absMinutes < 60) {
    return diff >= 0 ? `starts in ${absMinutes} minute${absMinutes === 1 ? "" : "s"}` : `${absMinutes} minute${absMinutes === 1 ? "" : "s"} ago`;
  }

  const absHours = Math.round(absMinutes / 60);
  return diff >= 0 ? `starts in ${absHours} hour${absHours === 1 ? "" : "s"}` : `${absHours} hour${absHours === 1 ? "" : "s"} ago`;
}

function formatDuration(startHour: number, endHour: number): string {
  const totalMinutes = Math.max(0, Math.round((endHour - startHour) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0 && minutes === 0) {
    return "0 min";
  }

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }

  return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min`;
}

function getEventStatus(notification: ActivityNotification): string | null {
  if (!notification.eventDate || notification.eventStartHour == null) {
    return null;
  }

  const start = buildDateTime(notification.eventDate, notification.eventStartHour);
  const end = buildDateTime(notification.eventDate, notification.eventEndHour ?? notification.eventStartHour + 1);
  const now = new Date();

  if (now < start) {
    return formatRelativeTime(start, now);
  }

  if (now >= start && now <= end) {
    return "ongoing";
  }

  return "done";
}

function getNotificationTypeLabel(notification: ActivityNotification): string {
  if (notification.type === "meeting") {
    return "Meeting";
  }

  if (notification.type === "schedule") {
    return "Activity";
  }

  if (notification.type === "task") {
    return "Task";
  }

  return "Deadline";
}

function formatNotificationTime(notification: ActivityNotification): string {
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

  const startText = formatClock(notification.eventStartHour).replace(" AM", "").replace(" PM", "");
  const suffix = formatClock(notification.eventStartHour).slice(-2);
  
  if (notification.eventEndHour != null) {
    return `${dateText} · ${startText}-${formatClock(notification.eventEndHour)}`;
  }

  return `${dateText} · ${startText} ${suffix}`;
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

export default function ActivityRoutePage() {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead, deleteAll, deleteNotification, loading } = useActivityNotifications();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleRowClick(notification: ActivityNotification) {
    if (!notification.readAt) {
      await markRead(notification.id);
    }

    router.push(notification.link);
  }

  async function handleDeleteAll() {
    setDeleting(true);

    try {
      await deleteAll();
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteOne(notificationId: string) {
    await deleteNotification(notificationId);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900">Notifications</span>
          {unreadCount > 0 ? (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold leading-none text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {notifications.length > 0 ? (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className={cn(designStandard.button.icon, "text-zinc-400 hover:text-red-600 hover:bg-red-50")}
              title="Delete all activity"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {unreadCount > 0 ? (
            <Button 
              type="button" 
              variant="outline" 
              size="xs" 
              className={designStandard.button.extraSmall}
              onClick={() => void markAllRead()}
              title="Mark all notifications as read"
            >
              Mark all read
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50/30">
        <div className="border-b border-zinc-200 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-900">
            <Clock3 className="size-4 text-black" />
            Activities
          </div>
          <p className="mt-1 text-[12px] text-zinc-500">Meetings, deadlines, and scheduled activities with creator, timing, and status.</p>
        </div>

        {loading ? (
          <div className="divide-y divide-zinc-200">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-4 sm:px-6">
                <div className="h-1.5 w-1.5 rounded-full mt-2.5 bg-zinc-100 animate-pulse" />
                <div className="h-7 w-7 rounded-[7px] bg-zinc-100 animate-pulse" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-3 w-40 rounded bg-zinc-100 animate-pulse" />
                  <div className="h-2.5 w-56 rounded bg-zinc-100 animate-pulse" />
                  <div className="flex gap-2 mt-1">
                    <div className="h-5 w-32 rounded-full bg-zinc-100 animate-pulse" />
                    <div className="h-5 w-16 rounded-full bg-zinc-100 animate-pulse" />
                  </div>
                </div>
                <div className="h-5 w-6 rounded-md bg-zinc-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-[12px] text-zinc-500">No activity yet</div>
        ) : (
          <div>
            {notifications.map((notification) => {
              let tone = getTone(notification.type);
              const isAssigned = notification.title.toLowerCase().includes("assigned");
              if (notification.type === "task" && isAssigned) {
                tone = { accent: designTokens.palette.app.status.danger, background: "#dc26261a", icon: tone.icon };
              }
              const isUnread = !notification.readAt;
              const Icon = tone.icon;
              const status = getEventStatus(notification);
              const typeLabel = getNotificationTypeLabel(notification);
              const timeLabel = formatNotificationTime(notification);
              const creatorLabel = notification.createdByName?.trim() ? `Created by ${notification.createdByName}` : null;
              const durationLabel =
                notification.eventDate && notification.eventStartHour != null && notification.eventEndHour != null
                  ? formatDuration(notification.eventStartHour, notification.eventEndHour)
                  : null;

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "relative flex gap-3 border-b border-zinc-200 px-4 py-4 transition-colors hover:bg-white sm:px-6",
                    ""
                  )}
                  style={isUnread ? { paddingLeft: "calc(1rem - 3px)" } : undefined}
                >
                  {isUnread && (
                    <div className="absolute inset-y-0 left-0" style={{ width: 3, backgroundColor: tone.accent }} />
                  )}
                  <span
                    className={cn(
                      "mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      isUnread ? "animate-pulse" : ""
                    )}
                    style={isUnread ? { backgroundColor: tone.accent } : { backgroundColor: "transparent" }}
                  />

                  <button
                    type="button"
                    onClick={() => void handleRowClick(notification)}
                    className={cn(
                      "flex min-w-0 flex-1 items-start gap-3 text-left",
                      designStandard.clickable.base
                    )}
                    title={`View ${notification.title}`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]"
                      style={{ backgroundColor: tone.background, color: tone.accent }}
                      aria-hidden="true"
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold text-zinc-900">{notification.title}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-zinc-500">
                            <span
                              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: notification.groupColor }}
                            />
                            <span className="truncate">{notification.groupName}</span>
                            <span className="opacity-40">·</span>
                            <span>{typeLabel}</span>
                            {creatorLabel ? (
                              <>
                                <span className="opacity-40">·</span>
                                <span className="truncate">{creatorLabel}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
                        {notification.eventDate ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5">
                            <Clock3 className="size-3" />
                            {timeLabel}
                          </span>
                        ) : null}
                        {durationLabel ? (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5">{durationLabel}</span>
                        ) : null}
                        {status ? (
                          <span
                            className={[
                              "rounded-full px-2 py-0.5",
                              status === "ongoing" ? "bg-emerald-100 text-emerald-700" : status === "done" ? "bg-zinc-200 text-zinc-600" : "bg-amber-100 text-amber-700",
                            ].join(" ")}
                          >
                            {status}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDeleteOne(notification.id)}
                    className={cn(
                      "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600",
                      designStandard.clickable.base
                    )}
                    title="Delete notification"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className={designStandard.modal.header}>
            <div className={designStandard.modal.badge}>Delete all activity</div>
            <DialogTitle className={designStandard.modal.title}>Clear your notifications?</DialogTitle>
            <p className={designStandard.modal.description}>
              This will permanently remove every notification for your account. This cannot be undone.
            </p>
          </DialogHeader>

          <DialogBody className="px-4 pb-4 sm:px-6">
            <div className={designStandard.cards.mutedPanel + " p-4 text-sm text-zinc-600"}>
              Meeting, deadline, and schedule notifications will disappear from this page and from the toast stack.
            </div>
          </DialogBody>

          <DialogFooter className="border-t-0 px-4 pb-4 pt-0 sm:px-6">
            <Button type="button" variant="outline" className={designStandard.button.outline} onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" className={designStandard.button.destructive} onClick={() => void handleDeleteAll()} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
