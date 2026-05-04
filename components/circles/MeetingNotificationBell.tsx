"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useUnreadMeetings } from "@/hooks/useUnreadMeetings";
import { cn } from "@/lib/utils";

function formatHour(hour: number) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function MeetingNotificationBell() {
  const { unread, count, markAllRead, markRead } = useUnreadMeetings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative px-2 pb-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900",
          open && "bg-zinc-100 text-zinc-900",
        )}
        aria-label={`Meetings — ${count} unread`}
      >
        <span className="relative inline-flex shrink-0">
          <Bell className="h-3.5 w-3.5" />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white leading-none">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </span>
        <span className="flex-1 text-left">Meetings</span>
        {count > 0 && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-72 overflow-hidden rounded-xl border border-border/70 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
            <span className="text-[12px] font-semibold text-zinc-900">
              New meetings
              {count > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {count}
                </span>
              )}
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-[10px] text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {unread.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-zinc-500">
                No new meeting invites
              </div>
            ) : (
              unread.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 border-b border-border/70 px-3 py-2.5 last:border-b-0"
                >
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-zinc-900">
                      {item.label}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {item.groupName} · {item.day} at {formatHour(item.startHour)}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      Added by {item.createdByName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void markRead(item.id)}
                    className="shrink-0 text-[9px] text-zinc-400 hover:text-zinc-700 transition-colors"
                    aria-label="Mark read"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
