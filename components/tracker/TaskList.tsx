"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, History, LockKeyhole, Milestone, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { designTokens } from "@/components/ui/design-standard";
import type { Methodology, Profile, TrackerSprint, TrackerTask } from "@/types";
import SprintHeader from "./SprintHeader";
import SprintWindowEditor from "./SprintWindowEditor";
import TaskCard from "./TaskCard";
import { getDueState, getSprintProgress, isSprintLocked, METHODOLOGIES, normalizeSprintStatus } from "./tracker-utils";

type TaskListProps = {
  sprints: TrackerSprint[];
  membersById: Map<string, Profile>;
  groupId: string;
  methodology: Methodology;
  canManage: boolean;
  onOpenTask: (task: TrackerTask) => void;
  onMarkSprintComplete: (sprintId: string) => void;
  onRefresh?: () => void;
};

const fieldClassName = cn(designTokens.spacing.field, "gap-2");
const inputClassName = "rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function TaskList({
  sprints,
  membersById,
  groupId,
  methodology,
  canManage,
  onOpenTask,
  onMarkSprintComplete,
  onRefresh,
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
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newSprintTitle, setNewSprintTitle] = useState("");
  const [newSprintGoal, setNewSprintGoal] = useState("");
  const [newSprintStart, setNewSprintStart] = useState("");
  const [newSprintEnd, setNewSprintEnd] = useState("");
  const [addingSpring, setAddingSpring] = useState(false);
  const [deletingSprintId, setDeletingSprintId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [backlogOpen, setBacklogOpen] = useState(true);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const method = METHODOLOGIES[methodology];
  const hideSprintSections = methodology === "simple" || methodology === "kanban";
  const realSprints = useMemo(
    () => sprints.filter((sprint) => sprint.id !== "__backlog"),
    [sprints],
  );
  const allTasks = useMemo(() => sprints.flatMap((sprint) => sprint.tasks), [sprints]);
  const backlogTasks = useMemo(
    () => allTasks.filter((task) => getDueState(task) === "overdue"),
    [allTasks],
  );
  const upcomingTasks = useMemo(
    () => allTasks.filter((task) => getDueState(task) !== "overdue"),
    [allTasks],
  );
  const lastSprint = useMemo(() => {
    const realSprints = sprints.filter((s) => s.id !== "__backlog");
    return realSprints.length > 0 ? realSprints[realSprints.length - 1] : null;
  }, [sprints]);

  const hasOverlap = useMemo(() => {
    if (!newSprintStart || !newSprintEnd) return false;
    const start = parseISO(newSprintStart);
    const end = parseISO(newSprintEnd);

    return sprints.some((s) => {
      if (s.id === "__backlog" || !s.start_date || !s.end_date) return false;
      const sStart = parseISO(s.start_date);
      const sEnd = parseISO(s.end_date);

      return start <= sEnd && end >= sStart;
    });
  }, [newSprintStart, newSprintEnd, sprints]);

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

  async function addNewSprint() {
    if (!newSprintTitle.trim()) {
      toast.error("Title required", "Enter a sprint title.");
      return;
    }
    if (!newSprintStart || !newSprintEnd) {
      toast.error("Dates required", "Select start and end dates.");
      return;
    }
    if (new Date(newSprintEnd) < new Date(newSprintStart)) {
      toast.error("Invalid date range", "End date must be after start date.");
      return;
    }

    setAddingSpring(true);
    try {
      const response = await fetch("/api/tracker/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          title: newSprintTitle.trim(),
          goal: newSprintGoal.trim(),
          start_date: newSprintStart,
          end_date: newSprintEnd,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to create sprint.");
      }

      toast.success("Sprint added", "New sprint created.");
      setAddDialogOpen(false);
      setNewSprintTitle("");
      setNewSprintGoal("");
      setNewSprintStart("");
      setNewSprintEnd("");
      onRefresh?.();
    } catch (error) {
      toast.error("Sprint not added", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setAddingSpring(false);
    }
  }

  async function deleteSprint(sprintId: string) {
    setDeleting(true);
    try {
      const response = await fetch(`/api/tracker/sprints/${sprintId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Unable to delete sprint.");
      }

      toast.success("Sprint deleted", "Sprint removed from tracker.");
      setDeletingSprintId(null);
      onRefresh?.();
    } catch (error) {
      toast.error("Sprint not deleted", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function resetSprints() {
    setResetting(true);
    try {
      const response = await fetch("/api/tracker/sprints/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Unable to reset sprints.");
      }
      toast.success("Sprints reset", "All sprints removed and tasks moved to backlog.");
      setResetDialogOpen(false);
      onRefresh?.();
    } catch (error) {
      toast.error("Reset failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="mb-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          {method.alert}
        </div>

        <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-3 bg-muted/50 px-4 py-3 text-left"
            onClick={() => setBacklogOpen((current) => !current)}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] font-bold text-muted-foreground">
              {backlogTasks.length}
            </span>
            <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition", backlogOpen && "rotate-90")} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">Backlog</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                Tasks past their due date live here.
              </div>
            </div>
          </button>

          {backlogOpen ? (
            <div className="border-t p-3">
              <div className="space-y-2">
                {backlogTasks.length > 0 ? (
                  backlogTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      assignee={task.assigned_to ? membersById.get(task.assigned_to) : null}
                      onOpen={onOpenTask}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
                    No overdue tasks right now.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>

        {hideSprintSections ? (
          <div className="space-y-3">
          <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-3 bg-muted/50 px-4 py-3 text-left"
              onClick={() => setTasksOpen((current) => !current)}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] font-bold text-muted-foreground">
                {upcomingTasks.length}
              </span>
              <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition", tasksOpen && "rotate-90")} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">Tasks</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  Upcoming tasks that are not past due.
                </div>
              </div>
            </button>

            {tasksOpen ? (
              <div className="border-t p-3">
                <div className="space-y-2">
                  {upcomingTasks.length > 0 ? (
                    upcomingTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        assignee={task.assigned_to ? membersById.get(task.assigned_to) : null}
                        onOpen={onOpenTask}
                      />
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
                      No upcoming tasks yet.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </section>
          </div>
        ) : null}

        {!hideSprintSections && canManage && (
          <div className="mb-6 flex w-full items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setAddDialogOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-violet-200 py-2 text-sm text-violet-700 hover:bg-violet-50/40"
            >
              <Plus className="size-4" />
              Add sprint
            </button>
            <button
              type="button"
              onClick={() => setResetDialogOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-red-200 py-2 text-sm text-red-700 hover:bg-red-50/40"
            >
              Reset sprints
            </button>
          </div>
        )}

        {!hideSprintSections && realSprints.map((sprint, index) => {
          const locked =
            isSprintLocked(realSprints, index, methodology) ||
            normalizeSprintStatus(sprint.status) === "locked";
          const visibleTasks = sprint.tasks.filter((task) => getDueState(task) !== "overdue");
          const open = openSprintIds.has(sprint.id) && !locked;
          const status = normalizeSprintStatus(sprint.status);
          const progress = getSprintProgress({ ...sprint, tasks: visibleTasks });
          const canComplete =
            canManage && !locked && status === "active" && sprint.id !== "__backlog";
          const canDelete =
            canManage && sprint.id !== "__backlog" && normalizeSprintStatus(sprint.status) !== "done";

          return (
            <div key={sprint.id}>
              {index > 0 && methodology !== "kanban" ? (
                <div
                  className={cn(
                    "mx-auto h-6 w-px bg-border",
                    sprints[index - 1] &&
                      normalizeSprintStatus(sprints[index - 1].status) === "done" &&
                      "bg-green-500",
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
                <div className="flex items-center gap-3 bg-muted/50 px-4 py-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    onClick={() => (locked ? undefined : toggleSprint(sprint.id))}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] font-bold text-muted-foreground",
                        status === "done" &&
                          "border-green-200 bg-green-600 text-white",
                        status === "active" &&
                          !locked &&
                          "border-blue-200 bg-blue-600 text-white",
                      )}
                    >
                      {status === "done" ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition",
                        open && "rotate-90",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {sprint.title}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {sprint.goal ??
                          `${progress.done}/${progress.total} tasks complete`}
                      </div>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeletingSprintId(sprint.id)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </button>
                    )}
                    {locked ? (
                      <Badge variant="secondary" className="gap-1">
                        <LockKeyhole className="size-3" />
                        Locked
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn(
                          status === "done" &&
                            "border-green-200 bg-green-50 text-green-700",
                          status === "active" &&
                            "border-amber-200 bg-amber-50 text-amber-700",
                        )}
                      >
                        {status === "done"
                          ? "Complete"
                          : status === "active"
                            ? "Active"
                            : methodology === "agile"
                              ? "Iteration"
                              : "Upcoming"}
                      </Badge>
                    )}
                  </div>
                </div>

                {open ? (
                  <div className="border-t p-3">
                    <SprintHeader sprint={sprint} locked={locked} />
                    {canManage && sprint.id !== "__backlog" && (
                      <SprintWindowEditor
                        sprint={sprint}
                        onSaved={onRefresh ?? (() => {})}
                      />
                    )}
                    <div className="mt-3 space-y-2">
                      {visibleTasks.length > 0 ? (
                        visibleTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            assignee={
                              task.assigned_to
                                ? membersById.get(task.assigned_to)
                                : null
                            }
                            onOpen={onOpenTask}
                          />
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
                          No tasks in this{" "}
                          {methodology === "waterfall" ? "phase" : "sprint"} yet.
                        </div>
                      )}
                    </div>
                    {canComplete ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <div className="text-xs text-blue-900">
                          PM action: mark this{" "}
                          {methodology === "waterfall"
                            ? "phase"
                            : "sprint"}{" "}
                          complete and unlock the next one.
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onMarkSprintComplete(sprint.id)}
                        >
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

      {/* Delete confirmation dialog */}
      {!hideSprintSections ? (
      <Dialog
        open={deletingSprintId !== null}
        onOpenChange={(open) => !open && setDeletingSprintId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete sprint?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              This will permanently remove the sprint and reassign its tasks to the backlog. This action
              cannot be undone.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingSprintId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingSprintId && deleteSprint(deletingSprintId)}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete sprint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}

      {/* Reset all sprints dialog */}
      {!hideSprintSections ? (
      <Dialog
        open={resetDialogOpen}
        onOpenChange={(open) => !open && setResetDialogOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset sprints?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              This will remove all sprints for this group and move all tasks back to the backlog. Only a PM can perform this action. This cannot be undone.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={resetSprints}
              disabled={resetting}
            >
              {resetting ? "Resetting..." : "Reset sprints"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}

      {/* Add sprint dialog */}
      {!hideSprintSections ? (
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add a new sprint</DialogTitle>
          </DialogHeader>
          <DialogBody className="gap-4">
            {lastSprint && (
              <div className="mb-2 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-violet-700 uppercase">
                  <History className="size-3" />
                  Follows previous sprint
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-violet-900">{lastSprint.title}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-violet-600">
                    <span>{lastSprint.start_date ? format(parseISO(lastSprint.start_date), "MMM d") : "?"}</span>
                    <ArrowRight className="size-3 opacity-50" />
                    <span>{lastSprint.end_date ? format(parseISO(lastSprint.end_date), "MMM d") : "?"}</span>
                  </div>
                </div>
              </div>
            )}

            {hasOverlap && (
              <div className="mb-2 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <div className="text-xs leading-relaxed">
                  <span className="font-semibold">Timeline overlap:</span> These dates clash with an existing sprint. You can still save if this is intentional.
                </div>
              </div>
            )}

            <div className={fieldClassName}>
              <Label htmlFor="new-sprint-title" className="text-xs font-medium">
                Title
              </Label>
              <Input
                id="new-sprint-title"
                className={inputClassName}
                placeholder="e.g. Sprint 1 - Planning"
                value={newSprintTitle}
                onChange={(e) => setNewSprintTitle(e.target.value)}
              />
            </div>

            <div className={fieldClassName}>
              <Label htmlFor="new-sprint-goal" className="text-xs font-medium">
                Goal (optional)
              </Label>
              <Input
                id="new-sprint-goal"
                className={inputClassName}
                placeholder="e.g. Define project scope and requirements"
                value={newSprintGoal}
                onChange={(e) => setNewSprintGoal(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={fieldClassName}>
                <Label htmlFor="new-sprint-start" className="text-xs font-medium">
                  Start date
                </Label>
                <Input
                  id="new-sprint-start"
                  type="date"
                  className={inputClassName}
                  value={newSprintStart}
                  onChange={(e) => setNewSprintStart(e.target.value)}
                />
              </div>

              <div className={fieldClassName}>
                <Label htmlFor="new-sprint-end" className="text-xs font-medium">
                  End date
                </Label>
                <Input
                  id="new-sprint-end"
                  type="date"
                  className={inputClassName}
                  value={newSprintEnd}
                  onChange={(e) => setNewSprintEnd(e.target.value)}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={addingSpring}
            >
              Cancel
            </Button>
            <Button onClick={addNewSprint} disabled={addingSpring}>
              {addingSpring ? "Adding..." : "Add sprint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}
    </>
  );
}
