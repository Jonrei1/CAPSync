"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Kanban, ListTree, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Group, Methodology, Profile, TrackerSprint, TrackerTask } from "@/types";
import AiTaskAssistant from "./AiTaskAssistant";
import KanbanBoard from "./KanbanBoard";
import TaskDetailSheet from "./TaskDetailSheet";
import TaskForm from "./TaskForm";
import { getAllTasks, normalizeMethodology } from "./tracker-utils";

type TrackerBoardWorkspaceProps = {
  group: Group;
  members: Profile[];
  sprints: TrackerSprint[];
  currentUserId: string;
  canManage: boolean;
};

export default function TrackerBoardWorkspace({ group, members, sprints, currentUserId, canManage }: TrackerBoardWorkspaceProps) {
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<TrackerTask | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const tasks = useMemo(() => getAllTasks(sprints), [sprints]);
  const methodology = normalizeMethodology(group.methodology) as Methodology;

  function refresh() {
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tracker Board</h1>
          <p className="mt-1 text-sm text-muted-foreground">Status pipeline for {group.name}.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="size-4" />
          Add task
        </Button>
      </div>

      <div className="flex rounded-lg border bg-muted p-1 w-fit">
        <Link className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground" href={`/${group.id}/tracker`}>
          <ListTree className="size-3.5" />
          List
        </Link>
        <Link className="inline-flex h-8 items-center gap-1.5 rounded-md bg-card px-3 text-xs font-medium shadow-xs" href={`/${group.id}/tracker/board`}>
          <Kanban className="size-3.5" />
          Board
        </Link>
        <Link
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground"
          href={`/${group.id}/tracker/calendar`}
        >
          <CalendarDays className="size-3.5" />
          Calendar
        </Link>
      </div>

      <KanbanBoard
        tasks={tasks}
        members={members}
        methodology={methodology}
        onOpenTask={setSelectedTask}
        groupId={group.id}
        currentUserId={currentUserId}
        canManage={canManage}
        sprints={sprints}
        onSaved={refresh}
      />

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        groupId={group.id}
        members={members}
        sprints={sprints}
        currentUserId={currentUserId}
        canManage={canManage}
        methodology={methodology}
        onSaved={refresh}
      />
      <TaskDetailSheet open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(null)} task={selectedTask} members={members} currentUserId={currentUserId} onSaved={refresh} />
      <AiTaskAssistant groupId={group.id} />
    </div>
  );
}
