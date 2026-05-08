"use client";

import { CalendarDays, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Profile, TrackerTask } from "@/types";
import {
  formatDateLabel,
  getDueState,
  getDisplayName,
  getInitials,
  getMemberColor,
  normalizeTaskStatus,
  STATUS_LABELS,
  STATUS_STYLES,
} from "./tracker-utils";

type TaskCardProps = {
  task: TrackerTask;
  assignee?: Profile | null;
  compact?: boolean;
  onOpen?: (task: TrackerTask) => void;
};

export default function TaskCard({ task, assignee, compact = false, onOpen }: TaskCardProps) {
  const status = normalizeTaskStatus(task.status);
  const dueState = getDueState(task);
  const resolvedAssignee = assignee ?? task.assignee ?? null;
  const assigneeColor = getMemberColor(resolvedAssignee);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(task)}
      className={cn(
        "group flex w-full cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 text-left shadow-xs transition hover:-translate-y-px hover:border-zinc-300 hover:shadow-md",
        compact && "gap-2 p-2.5",
      )}
      style={{ borderLeftColor: assigneeColor, borderLeftWidth: 3 }}
    >
      <span
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
        style={{ backgroundColor: assigneeColor }}
        title={getDisplayName(resolvedAssignee)}
      >
        {resolvedAssignee ? getInitials(resolvedAssignee) : "NA"}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[13px] font-medium text-foreground",
            status === "done" && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>
        {task.description && !compact ? (
          <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{task.description}</span>
        ) : null}
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", STATUS_STYLES[status])}>
            {STATUS_LABELS[status]}
          </Badge>
          {task.priority ? (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] capitalize">
              {task.priority}
            </Badge>
          ) : null}
          {task.requires_pm_approval ? (
            <Badge variant="outline" className="border-purple-200 bg-purple-50 px-1.5 py-0 text-[10px] text-purple-700">
              PM approval
            </Badge>
          ) : null}
        </span>
      </span>

      <span
        className={cn(
          "ml-auto flex shrink-0 items-center gap-1 pt-0.5 font-mono text-[11px] text-muted-foreground",
          dueState === "overdue" && "font-semibold text-red-600",
          dueState === "soon" && "font-semibold text-amber-700",
        )}
      >
        {dueState === "overdue" ? <CircleAlert className="size-3" /> : <CalendarDays className="size-3" />}
        {formatDateLabel(task.due_date)}
      </span>
    </button>
  );
}
