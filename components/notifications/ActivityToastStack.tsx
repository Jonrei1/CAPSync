"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, CalendarPlus, CheckSquare2, Flag, X } from "lucide-react";
import { designTokens } from "@/components/ui/design-standard";
import type { ActivityNotification } from "@/hooks/useActivityNotifications";

type Props = {
  notifications: ActivityNotification[];
  onMarkRead: (id: string) => Promise<void>;
  onOpenActivity: () => void;
};

const TOAST_DURATION_MS = 5_000;
const MAX_VISIBLE_TOASTS = 3;
const RECENT_WINDOW_MS = 10 * 60 * 1_000;

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
    case "task":
      return { accent: "#7c3aed", icon: CheckSquare2 };
  }
}

function formatShortTime(notification: ActivityNotification): string {
  if (!notification.eventDate) {
    return "";
  }

  const date = new Date(`${notification.eventDate}T12:00:00`);
  const dateText = date.toLocaleDateString("en-PH", {
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

export default function ActivityToastStack({ notifications, onMarkRead, onOpenActivity }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [referenceNow] = useState(() => Date.now());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const recentUnread = notifications
    .filter((notification) => {
      if (notification.readAt) {
        return false;
      }

      if (dismissed.has(notification.id)) {
        return false;
      }

      const age = referenceNow - new Date(notification.createdAt).getTime();
      return age < RECENT_WINDOW_MS;
    })
    .slice(0, MAX_VISIBLE_TOASTS);

  function dismiss(id: string) {
    setDismissed((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });

    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }

  async function handleClick(notification: ActivityNotification) {
    dismiss(notification.id);
    await onMarkRead(notification.id);
    onOpenActivity();
  }

  useEffect(() => {
    const activeIds = new Set(recentUnread.map((notification) => notification.id));

    for (const [id, timer] of timersRef.current.entries()) {
      if (!activeIds.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    }

    for (const notification of recentUnread) {
      if (timersRef.current.has(notification.id)) {
        continue;
      }

      const timer = setTimeout(() => {
        dismiss(notification.id);
      }, TOAST_DURATION_MS);

      timersRef.current.set(notification.id, timer);
    }
  }, [recentUnread]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  if (recentUnread.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-90 flex w-[320px] flex-col-reverse gap-2"
      aria-live="polite"
      aria-label="Activity notifications"
    >
      {recentUnread.map((notification) => {
        const tone = getTone(notification.type);

        return (
          <div
            key={notification.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 shadow-lg"
            style={{ borderLeftWidth: 2, borderLeftColor: tone.accent }}
            role="alert"
          >
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: tone.accent }}
              aria-hidden="true"
            >
              <tone.icon className="h-3.5 w-3.5" />
            </span>

            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void handleClick(notification)}>
              <div className="truncate text-[12px] font-semibold text-zinc-900">{notification.title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: notification.groupColor }}
                />
                <span className="truncate">{notification.groupName}</span>
                {notification.eventDate ? (
                  <>
                    <span className="opacity-40">·</span>
                    <span>{formatShortTime(notification)}</span>
                  </>
                ) : null}
              </div>
            </button>

            <button
              type="button"
              onClick={() => dismiss(notification.id)}
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600"
              aria-label="Dismiss notification"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}