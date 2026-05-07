"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CalendarPlus, Flag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { designStandard, designTokens } from "@/components/ui/design-standard";
import { useActivityNotifications } from "@/hooks/useActivityNotifications";

function getTone(type: any) {
  switch (type as any) {
    case "meeting":
      return { accent: designTokens.palette.app.brandPrimary, icon: CalendarPlus };
    case "deadline":
      return { accent: designTokens.palette.app.status.danger, icon: Flag };
    case "schedule":
      return { accent: designTokens.palette.app.brandAccent, icon: Calendar };
    default:
      return { accent: designTokens.palette.app.brandPrimary, icon: Calendar };
  }
}

function formatEventTime(notification: any): string {
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

export default function ActivityRoutePage() {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead, deleteAll } = useActivityNotifications();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleRowClick(notification: any) {
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

  return (
    <div className="flex h-full flex-col border-r border-border/70 bg-white shadow-sm">
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
          {notifications.length > 0 ? (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
              aria-label="Delete all activity notifications"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {unreadCount > 0 ? (
            <button type="button" onClick={() => void markAllRead()} className={designStandard.clickable.subtle}>
              Mark all read
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-[12px] text-zinc-500">No activity yet</div>
        ) : (
          notifications.map((notification: any) => {
            const tone = getTone(notification.type as any);
            const isUnread = !notification.readAt;
            const Icon = (tone as any).icon;

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
                  className={["mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full", isUnread ? "bg-indigo-600" : "bg-transparent"].join(" ")}
                />

                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-white"
                  style={{ backgroundColor: (tone as any).accent }}
                  aria-hidden="true"
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-zinc-900">{notification.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: notification.groupColor }} />
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

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className={designStandard.modal.header}>
            <div className={designStandard.modal.badge}>Delete all activity</div>
            <DialogTitle className={designStandard.modal.title}>Clear your activity feed?</DialogTitle>
            <p className={designStandard.modal.description}>
              This will permanently remove every activity notification for your account. This cannot be undone.
            </p>
          </DialogHeader>

          <DialogBody className="px-4 pb-4 sm:px-6">
            <div className={designStandard.cards.mutedPanel + " p-4 text-sm text-zinc-600"}>
              All meeting, deadline, and schedule notifications will disappear from this feed and from the toast stack.
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
