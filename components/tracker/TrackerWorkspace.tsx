"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CircleAlert, Kanban, ListTree, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import type { Group, Methodology, Profile, TrackerSprint, TrackerTask } from "@/types";
import AiTaskAssistant from "./AiTaskAssistant";
import MethodologyBanner from "./MethodologyBanner";
import MethodologyDialog from "./MethodologyDialog";
import TaskDetailSheet from "./TaskDetailSheet";
import TaskForm from "./TaskForm";
import TaskList from "./TaskList";
import SprintScaffoldBanner from "./SprintScaffoldBanner";
import {
  getAllTasks,
  getDisplayName,
  getInitials,
  getMemberColor,
  getTrackerStats,
  normalizeMethodology,
  STATUS_LABELS,
  STATUS_STYLES,
  TASK_STATUSES,
} from "./tracker-utils";
import { ProgressBar } from "./mini";

type TrackerWorkspaceProps = {
  group: Group;
  members: Profile[];
  sprints: TrackerSprint[];
  currentUserId: string;
  canManage?: boolean;
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-lg bg-muted p-4">
      <div className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

export default function TrackerWorkspace({ group, members, sprints, currentUserId, canManage = false }: TrackerWorkspaceProps) {
  const router = useRouter();
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TrackerTask | null>(null);
  const methodology = normalizeMethodology(group.methodology) as Methodology;
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const tasks = useMemo(() => getAllTasks(sprints), [sprints]);
  const stats = useMemo(() => getTrackerStats(tasks), [tasks]);

  function refresh() {
    router.refresh();
  }

  async function markSprintComplete(sprintId: string) {
    try {
      const response = await fetch(`/api/tracker/sprints/${sprintId}/complete`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to complete sprint.");
      }

      toast.success("Sprint marked complete", "The next phase is unlocked when available.");
      refresh();
    } catch (error) {
      toast.error("Sprint not completed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Progress Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operational capstone workboard for {group.name}.</p>
        </div>
        <Button onClick={() => setTaskFormOpen(true)}>
          <Plus className="size-4" />
          Add task
        </Button>
      </div>

      <div className="responsive-grid-4">
        <StatCard label="Overall progress" value={`${stats.progress}%`} sub={`${stats.doneTasks}/${stats.totalTasks} tasks complete`} />
        <StatCard label="Tasks done" value={stats.doneTasks} sub="Completed tracker items" />
        <StatCard label="Due this week" value={stats.dueThisWeek} sub="Open tasks in current week" />
        <StatCard label="Overdue" value={stats.overdue} sub="Needs immediate attention" />
      </div>
      <ProgressBar value={stats.progress} />

      <MethodologyBanner methodology={methodology} canManage={canManage} onChangeClick={() => setMethodologyOpen(true)} />

      {canManage &&
        sprints.filter((s) => s.id !== "__backlog").length === 0 &&
        (methodology === "scrum" || methodology === "waterfall" || methodology === "agile") && (
          <SprintScaffoldBanner groupId={group.id} onSaved={refresh} />
        )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border bg-muted p-1">
          <Link className="inline-flex h-8 items-center gap-1.5 rounded-md bg-card px-3 text-xs font-medium shadow-xs" href={`/${group.id}/tracker`}>
            <ListTree className="size-3.5" />
            List
          </Link>
          <Link className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground" href={`/${group.id}/tracker/board`}>
            <Kanban className="size-3.5" />
            Board
          </Link>
          <Link className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground" href={`/${group.id}/tracker/calendar`}>
            <CalendarDays className="size-3.5" />
            Calendar
          </Link>
        </div>
        {methodology === "kanban" ? (
          <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
            Kanban teams usually work fastest from Board view
          </Badge>
        ) : null}
      </div>

      <Card className="gap-3 rounded-lg p-4 shadow-xs">
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-64 flex-1">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4" />
              Member colors
            </div>
            <div className="flex flex-wrap gap-2">
              {members.map((member, index) => (
                <div key={member.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="flex size-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                    style={{ backgroundColor: getMemberColor(member, index) }}
                  >
                    {getInitials(member)}
                  </span>
                  {getDisplayName(member)}
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-64 flex-1">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <CircleAlert className="size-4" />
              Task status
            </div>
            <div className="flex flex-wrap gap-2">
              {TASK_STATUSES.map((status) => (
                <Badge key={status} variant="outline" className={STATUS_STYLES[status]}>
                  {STATUS_LABELS[status]}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TaskList
          sprints={sprints}
          membersById={membersById}
          methodology={methodology}
          canManage={canManage}
          onOpenTask={setSelectedTask}
          onMarkSprintComplete={markSprintComplete}
          onRefresh={refresh}
        />
        <AiTaskAssistant groupId={group.id} />
      </div>

      <TaskForm
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        groupId={group.id}
        members={members}
        sprints={sprints}
        currentUserId={currentUserId}
        canManage={canManage}
        methodology={methodology}
        onSaved={refresh}
      />
      <TaskDetailSheet open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(null)} task={selectedTask} members={members} currentUserId={currentUserId} onSaved={refresh} />
      <MethodologyDialog
        open={methodologyOpen}
        onOpenChange={setMethodologyOpen}
        groupId={group.id}
        methodology={methodology}
        onSaved={refresh}
      />
    </div>
  );
}
