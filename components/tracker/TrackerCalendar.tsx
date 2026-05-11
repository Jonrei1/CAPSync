"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Kanban, ListTree, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Group, Methodology, Profile, TrackerSprint, TrackerTask } from "@/types";
import { getTasksForCalendar, type CalendarTaskEvent } from "@/lib/tracker/getTasksForCalendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import AiTaskAssistant from "./AiTaskAssistant";
import TaskDetailSheet from "./TaskDetailSheet";
import TaskForm from "./TaskForm";
import { getDisplayName, getInitials, getMemberColor, normalizeMethodology, normalizeTaskStatus, STATUS_LABELS, STATUS_STYLES, TASK_STATUSES } from "./tracker-utils";

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
  const searchParams = useSearchParams();
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

  const deadlineDateObjects = useMemo(() => {
    return Array.from(eventsByDate.values())
      .flat()
      .filter((event) => event.isDeadline)
      .map((event) => parseISO(event.date));
  }, [eventsByDate]);

  const calendarDays = useMemo(() => {
    const first = startOfWeek(startOfMonth(month));
    const last = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start: first, end: last });
  }, [month]);
  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  useEffect(() => {
    const dateParam = searchParams.get("date");
    const taskId = searchParams.get("task");

    if (!dateParam) {
      return;
    }

    setSelectedDate(dateParam);

    if (!taskId) {
      setSelectedTask(null);
      return;
    }

    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }

    setSelectedTask(task);
  }, [searchParams, tasks]);

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
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))} className="h-8 px-3 text-xs">
            Today
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((current) => subMonths(current, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="w-35 text-center text-sm font-semibold hover:bg-muted">
                {format(month, "MMMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={month}
                onSelect={(newDate: Date | undefined) => newDate && setMonth(newDate)}
                defaultMonth={month}
                deadlineDates={deadlineDateObjects}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((current) => addMonths(current, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-6 rounded-lg border bg-card px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Users className="size-3.5 text-muted-foreground" />
            Members
          </div>
          <div className="flex flex-wrap gap-3">
            {members.map((m, idx) => {
              const color = getMemberColor(m, idx);
              return (
                <div key={m.id} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span
                    className="flex size-4 items-center justify-center rounded-full text-[8px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    {getInitials(m)}
                  </span>
                  {getDisplayName(m)}
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="flex size-4 items-center justify-center rounded-full bg-zinc-400 text-[8px] font-bold text-white shadow-sm">
                U
              </span>
              Unassigned
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <AlertCircle className="size-3.5 text-muted-foreground" />
            Status
          </div>
          <div className="flex flex-wrap gap-2">
            {TASK_STATUSES.map((status) => (
              <div key={status} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status]}`}>
                {STATUS_LABELS[status]}
              </div>
            ))}
          </div>
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
            const isCurrentMonth = isSameMonth(date, month);

            if (!isCurrentMonth) {
              return <div key={key} className="min-h-24 p-2" />;
            }

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                className={[
                  "flex min-h-24 cursor-pointer flex-col rounded-md border p-2 text-left transition hover:border-zinc-400 bg-background",
                  isToday(date) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "",
                ].join(" ")}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={`text-xs font-semibold ${isToday(date) ? "text-primary" : ""}`}>{format(date, "d")}</span>
                  {dayEvents.some((event) => event.isDeadline) ? <span className="size-2 rounded-full bg-red-500" /> : null}
                </div>
                <div className="mt-2 flex-1 space-y-1 w-full overflow-hidden">
                  {dayEvents.slice(0, 4).map((event) => (
                    <div
                      key={event.id}
                      className={`flex w-full items-center gap-1.5 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[normalizeTaskStatus(event.task.status)]}`}
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: event.assigneeColor }} />
                      <span className="truncate">
                        {event.isDeadline ? "Due: " : ""}
                        {event.label}
                      </span>
                    </div>
                  ))}
                  {dayEvents.length > 4 ? <div className="text-[10px] font-medium text-muted-foreground">+{dayEvents.length - 4} more</div> : null}
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
        methodology={methodology}
        defaultDueDate={selectedDate ?? toDateKey(addDays(new Date(), 0))}
        defaultStatus={methodology === "kanban" ? "todo" : "todo"}
        onSaved={refresh}
      />
      <TaskDetailSheet open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(null)} task={selectedTask} members={members} currentUserId={currentUserId} onSaved={refresh} />
      <AiTaskAssistant groupId={group.id} />
    </div>
  );
}
