"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, LockKeyhole, Milestone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Methodology, Profile, TrackerSprint, TrackerTask } from "@/types";
import SprintHeader from "./SprintHeader";
import TaskCard from "./TaskCard";
import { getSprintProgress, isSprintLocked, METHODOLOGIES, normalizeSprintStatus } from "./tracker-utils";

type TaskListProps = {
  sprints: TrackerSprint[];
  membersById: Map<string, Profile>;
  methodology: Methodology;
  canManage: boolean;
  onOpenTask: (task: TrackerTask) => void;
  onMarkSprintComplete: (sprintId: string) => void;
};

export default function TaskList({
  sprints,
  membersById,
  methodology,
  canManage,
  onOpenTask,
  onMarkSprintComplete,
}: TaskListProps) {
  const defaultOpen = useMemo(
    () =>
      new Set(
        sprints
          .filter((sprint, index) => normalizeSprintStatus(sprint.status) === "active" || !isSprintLocked(sprints, index, methodology))
          .map((sprint) => sprint.id),
      ),
    [methodology, sprints],
  );
  const [openSprintIds, setOpenSprintIds] = useState<Set<string>>(defaultOpen);
  const method = METHODOLOGIES[methodology];

  function toggleSprint(sprintId: string) {
    setOpenSprintIds((current) => {
      const next = new Set(current);
      if (next.has(sprintId)) {
        next.delete(sprintId);
      } else {
        next.add(sprintId);
      }
      return next;
    });
  }

  if (sprints.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-8 text-center">
        <Milestone className="mx-auto size-8 text-muted-foreground" />
        <div className="mt-3 text-sm font-medium">No phases yet</div>
        <p className="mt-1 text-xs text-muted-foreground">Add a task now, then create sprints as your capstone plan takes shape.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="mb-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">{method.alert}</div>
      {sprints.map((sprint, index) => {
        const locked = isSprintLocked(sprints, index, methodology) || normalizeSprintStatus(sprint.status) === "locked";
        const open = openSprintIds.has(sprint.id) && !locked;
        const status = normalizeSprintStatus(sprint.status);
        const progress = getSprintProgress(sprint);
        const canComplete = canManage && !locked && status === "active" && sprint.id !== "__backlog";

        return (
          <div key={sprint.id}>
            {index > 0 && methodology !== "kanban" ? (
              <div
                className={cn(
                  "mx-auto h-6 w-px bg-border",
                  sprints[index - 1] && normalizeSprintStatus(sprints[index - 1].status) === "done" && "bg-green-500",
                )}
              />
            ) : null}
            <section
              className={cn(
                "overflow-hidden rounded-lg border bg-card shadow-xs",
                locked && "opacity-65",
                status === "active" && !locked && "border-blue-200 shadow-blue-100",
                status === "done" && "border-green-200",
              )}
            >
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 bg-muted/50 px-4 py-3 text-left"
                onClick={() => (locked ? undefined : toggleSprint(sprint.id))}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] font-bold text-muted-foreground",
                    status === "done" && "border-green-200 bg-green-600 text-white",
                    status === "active" && !locked && "border-blue-200 bg-blue-600 text-white",
                  )}
                >
                  {status === "done" ? <CheckCircle2 className="size-3.5" /> : index + 1}
                </span>
                <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-90")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{sprint.title}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {sprint.goal ?? `${progress.done}/${progress.total} tasks complete`}
                  </div>
                </div>
                {locked ? (
                  <Badge variant="secondary" className="gap-1">
                    <LockKeyhole className="size-3" />
                    Locked
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      status === "done" && "border-green-200 bg-green-50 text-green-700",
                      status === "active" && "border-amber-200 bg-amber-50 text-amber-700",
                    )}
                  >
                    {status === "done" ? "Complete" : status === "active" ? "Active" : methodology === "agile" ? "Iteration" : "Upcoming"}
                  </Badge>
                )}
              </button>

              {open ? (
                <div className="border-t p-3">
                  <SprintHeader sprint={sprint} locked={locked} />
                  <div className="mt-3 space-y-2">
                    {sprint.tasks.length > 0 ? (
                      sprint.tasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          assignee={task.assigned_to ? membersById.get(task.assigned_to) : null}
                          onOpen={onOpenTask}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
                        No tasks in this {methodology === "waterfall" ? "phase" : "sprint"} yet.
                      </div>
                    )}
                  </div>
                  {canComplete ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                      <div className="text-xs text-blue-900">
                        PM action: mark this {methodology === "waterfall" ? "phase" : "sprint"} complete and unlock the next one.
                      </div>
                      <Button size="sm" onClick={() => onMarkSprintComplete(sprint.id)}>
                        Mark complete
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        );
      })}
    </div>
  );
}
