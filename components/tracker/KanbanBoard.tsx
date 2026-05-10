"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Methodology, Profile, TaskStatus, TrackerSprint, TrackerTask } from "@/types";
import TaskCard from "./TaskCard";
import TaskForm from "./TaskForm";
import { normalizeTaskStatus, STATUS_LABELS } from "./tracker-utils";

type KanbanBoardProps = {
  tasks: TrackerTask[];
  members: Profile[];
  methodology: Methodology;
  onOpenTask: (task: TrackerTask) => void;
  groupId?: string;
  currentUserId?: string;
  canManage?: boolean;
  sprints?: TrackerSprint[];
  onSaved?: () => void;
};

const BOARD_STATUSES: TaskStatus[] = ["todo", "doing", "review", "done"];

export default function KanbanBoard({
  tasks,
  members,
  methodology,
  onOpenTask,
  groupId,
  currentUserId,
  canManage = false,
  sprints = [],
  onSaved = () => undefined,
}: KanbanBoardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const grouped = useMemo(() => {
    const next = new Map<TaskStatus, TrackerTask[]>(BOARD_STATUSES.map((status) => [status, []]));
    tasks.forEach((task) => {
      const status = normalizeTaskStatus(task.status);
      const key = status === "blocked" ? "review" : status;
      next.get(key)?.push(task);
    });
    return next;
  }, [tasks]);

  const labels =
    methodology === "kanban"
      ? {
          todo: "To Do (Backlog)",
          doing: "In Progress",
          review: "Review / Blocked",
          done: "Done",
          blocked: "Blocked",
        }
      : STATUS_LABELS;

  function openCreate(status: TaskStatus) {
    setDefaultStatus(status);
    setFormOpen(true);
  }

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
        {BOARD_STATUSES.map((status) => {
          const columnTasks = grouped.get(status) ?? [];
          return (
            <section key={status} className="min-h-80 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-2 border-b bg-card px-3 py-2.5">
                <div className="text-sm font-semibold">{labels[status]}</div>
                <div className="ml-auto font-mono text-xs text-muted-foreground">{columnTasks.length}</div>
              </div>
              <div className="flex min-h-48 flex-col gap-2 p-2.5">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    assignee={task.assigned_to ? membersById.get(task.assigned_to) : null}
                    compact
                    onOpen={onOpenTask}
                  />
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-auto justify-start border-dashed bg-transparent text-muted-foreground"
                  onClick={() => openCreate(status)}
                >
                  <Plus className="size-3.5" />
                  Add task
                </Button>
              </div>
            </section>
          );
        })}
      </div>

      {groupId && currentUserId ? (
        <TaskForm
          open={formOpen}
          onOpenChange={setFormOpen}
          groupId={groupId}
          members={members}
          sprints={sprints}
          currentUserId={currentUserId}
          canManage={canManage}
          methodology={methodology}
          defaultStatus={defaultStatus}
          onSaved={onSaved}
        />
      ) : null}
    </>
  );
}
