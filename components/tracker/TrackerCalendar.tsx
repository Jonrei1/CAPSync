"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Kanban, ListTree, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Group, Methodology, Profile, TrackerSprint, TrackerTask } from "@/types";
import { getTasksForCalendar, type CalendarTaskEvent } from "@/lib/tracker/getTasksForCalendar";
import TaskDetailSheet from "./TaskDetailSheet";
import TaskForm from "./TaskForm";
import { normalizeMethodology, normalizeTaskStatus, STATUS_STYLES } from "./tracker-utils";

type TrackerCalendarProps = {
  group: Group;
  members: Profile[];
  sprints: TrackerSprint[];
  tasks: TrackerTask[];
  currentUserId: string;
  canManage: boolean;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export default function TrackerCalendar({ group, members, sprints, tasks, currentUserId, canManage }: TrackerCalendarProps) {
  const router = useRouter();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TrackerTask | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const methodology = normalizeMethodology(group.methodology) as Methodology;
  const events = useMemo(() => getTasksForCalendar(tasks, members), [members, tasks]);
  const eventsByDate = useMemo(() => {
    const next = new Map<string, CalendarTaskEvent[]>();
    events.forEach((event) => {
      const bucket = next.get(event.date) ?? [];
      bucket.push(event);
      next.set(event.date, bucket);
    });
    return next;
  }, [events]);
  const calendarDays = useMemo(() => {
    const first = startOfWeek(startOfMonth(month));
    const last = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start: first, end: last });
  }, [month]);
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  function refresh() {
    router.refresh();
  }

  function openAddForDate(date: string) {
    setSelectedDate(date);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tracker Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Due dates, task windows, and deadline flags for {group.name}.</p>
        </div>
        <Button onClick={() => openAddForDate(toDateKey(new Date()))}>
          <Plus className="size-4" />
          Add task
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border bg-muted p-1">
          <Link className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground" href={`/${group.id}/tracker`}>
            <ListTree className="size-3.5" />
            List
          </Link>
          <Link className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground" href={`/${group.id}/tracker/board`}>
            <Kanban className="size-3.5" />
            Board
          </Link>
          <Link
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-card px-3 text-xs font-medium shadow-xs"
            href={`/${group.id}/tracker/calendar`}
          >
            <CalendarDays className="size-3.5" />
            Calendar
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((current) => subMonths(current, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="w-36 text-center text-sm font-semibold">{format(month, "MMMM yyyy")}</div>
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((current) => addMonths(current, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3 shadow-xs">
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((label) => (
            <div key={label} className="px-1 py-2 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </div>
          ))}
          {calendarDays.map((date) => {
            const key = toDateKey(date);
            const dayEvents = eventsByDate.get(key) ?? [];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                className={[
                  "min-h-28 cursor-pointer rounded-md border p-2 text-left transition hover:border-zinc-400",
                  isSameMonth(date, month) ? "bg-background" : "bg-muted/40 text-muted-foreground",
                  isToday(date) ? "border-zinc-900" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{format(date, "d")}</span>
                  {dayEvents.some((event) => event.isDeadline) ? <span className="size-2 rounded-full bg-red-500" /> : null}
                </div>
                <div className="mt-2 space-y-1">
                  {dayEvents.slice(0, 4).map((event) => (
                    <div
                      key={event.id}
                      className={`truncate rounded-full border px-2 py-0.5 text-[10px] ${STATUS_STYLES[normalizeTaskStatus(event.task.status)]}`}
                      style={{ borderLeftColor: event.assigneeColor, borderLeftWidth: 3 }}
                    >
                      {event.isDeadline ? "Due: " : ""}
                      {event.label}
                    </div>
                  ))}
                  {dayEvents.length > 4 ? <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 4} more</div> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={Boolean(selectedDate)} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedDate ? format(parseISO(selectedDate), "MMMM d, yyyy") : "Tasks"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-2">
              {selectedEvents.length ? (
                selectedEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedTask(event.task)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg border p-3 text-left hover:bg-muted/50"
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: event.assigneeColor }} />
                    <span className="min-w-0 flex-1 truncate text-sm">{event.task.title}</span>
                    <span className="text-xs text-muted-foreground">{event.isDeadline ? "Deadline" : "Task window"}</span>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">No tracker tasks on this day.</div>
              )}
              <Button variant="outline" className="w-full justify-start" onClick={() => selectedDate && openAddForDate(selectedDate)}>
                <Plus className="size-4" />
                Add task on this day
              </Button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        groupId={group.id}
        members={members}
        sprints={sprints}
        currentUserId={currentUserId}
        canManage={canManage}
        defaultDueDate={selectedDate ?? toDateKey(addDays(new Date(), 0))}
        defaultStatus={methodology === "kanban" ? "todo" : "todo"}
        onSaved={refresh}
      />
      <TaskDetailSheet open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(null)} task={selectedTask} members={members} onSaved={refresh} />
    </div>
  );
}
