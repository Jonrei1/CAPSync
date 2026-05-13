import { addDays, endOfWeek, format, isBefore, isSameDay, isWithinInterval, parseISO, startOfDay, startOfWeek } from "date-fns";
import { Kanban, LayoutList, ListChecks, RefreshCcw } from "lucide-react";
import type { Methodology, Profile, SprintStatus, TaskStatus, TrackerSprint, TrackerTask } from "@/types";

export const MEMBER_FALLBACK_COLORS = ["#4f46e5", "#16a34a", "#ea580c", "#9333ea"] as const;

export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "review", "done", "blocked"];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "Doing",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};

export const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: "border-zinc-200 bg-zinc-100 text-zinc-700",
  doing: "border-blue-200 bg-blue-50 text-blue-700",
  review: "border-amber-200 bg-amber-50 text-amber-800",
  done: "border-green-200 bg-green-50 text-green-700",
  blocked: "border-red-200 bg-red-50 text-red-700",
};

export const METHODOLOGIES = {
  simple: {
    icon: LayoutList,
    name: "Simple — no methodology",
    badge: "Flexible",
    description: "Just tasks and deadlines. No sprints, no phases, no constraints.",
    alert: "Simple mode: no sprint structure. Add tasks freely with a title, assignee, and due date.",
    preview: "Simple mode removes all methodology overhead. Best for groups who want a plain task list with deadlines and nothing else.",
  },
  scrum: {
    icon: ListChecks,
    name: "Scrum - 2-week sprints",
    badge: "Structured",
    description: "Tasks are organized into fixed sprints. Complete all tasks in a sprint before the next one unlocks.",
    alert: "Scrum mode: phases represent sprints. Complete sprint work before the next sprint unlocks.",
    preview:
      "Scrum uses fixed sprint cycles, adviser check-ins, and PM sprint completion before the next sprint opens.",
  },
  agile: {
    icon: RefreshCcw,
    name: "Agile - Iterative cycles",
    badge: "Adaptive",
    description: "Overlapping iterative cycles. Tasks can move across iterations.",
    alert: "Agile mode: phases are soft iterations. Keep the backlog prioritized and adapt after feedback.",
    preview:
      "Agile keeps iteration checkpoints visible while allowing work to shift as your capstone scope changes.",
  },
  kanban: {
    icon: Kanban,
    name: "Kanban - Continuous flow",
    badge: "Flow-based",
    description: "Continuous task flow with WIP limits.",
    alert: "Kanban mode: no phase locks. Use the board to keep work flowing and bottlenecks visible.",
    preview:
      "Kanban emphasizes To Do, Doing, Review, and Done columns for ongoing thesis and build work.",
  },
} satisfies Record<
  Methodology,
  {
    icon: typeof LayoutList | typeof ListChecks;
    name: string;
    badge: string;
    description: string;
    alert: string;
    preview: string;
  }
>;

export function normalizeMethodology(value: unknown): Methodology {
  return value === "simple" || value === "agile" || value === "kanban" || value === "scrum" ? value : "simple";
}

export function normalizeTaskStatus(value: unknown): TaskStatus {
  return value === "doing" || value === "review" || value === "done" || value === "blocked" || value === "todo"
    ? value
    : "todo";
}

export function normalizeSprintStatus(value: unknown): SprintStatus {
  return value === "active" || value === "done" || value === "locked" || value === "upcoming" ? value : "upcoming";
}

export function getMemberColor(member: Profile | null | undefined, index = 0) {
  return member?.color ?? MEMBER_FALLBACK_COLORS[index % MEMBER_FALLBACK_COLORS.length];
}

export function getDisplayName(profile: Pick<Profile, "full_name" | "email" | "id"> | null | undefined) {
  return profile?.full_name?.trim() || profile?.email?.split("@")[0] || "Unassigned";
}

export function getInitials(profile: Pick<Profile, "full_name" | "email" | "id"> | null | undefined) {
  const name = getDisplayName(profile);
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function getAllTasks(sprints: TrackerSprint[]) {
  return sprints.flatMap((sprint) => sprint.tasks);
}

export function getTrackerStats(tasks: TrackerTask[]) {
  const today = startOfDay(new Date());
  const week = {
    start: startOfWeek(today),
    end: endOfWeek(today),
  };
  const doneTasks = tasks.filter((task) => normalizeTaskStatus(task.status) === "done").length;
  const totalTasks = tasks.length;
  const dueThisWeek = tasks.filter((task) => {
    if (!task.due_date || normalizeTaskStatus(task.status) === "done") {
      return false;
    }
    const due = parseISO(task.due_date);
    return isWithinInterval(due, week);
  }).length;
  const overdue = tasks.filter((task) => {
    if (!task.due_date || normalizeTaskStatus(task.status) === "done") {
      return false;
    }
    return isBefore(parseISO(task.due_date), today);
  }).length;

  return {
    totalTasks,
    doneTasks,
    progress: totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100),
    dueThisWeek,
    overdue,
  };
}

export function getSprintProgress(sprint: TrackerSprint) {
  const total = sprint.tasks.length;
  const done = sprint.tasks.filter((task) => normalizeTaskStatus(task.status) === "done").length;
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

export function isSprintLocked(sprints: TrackerSprint[], sprintIndex: number, methodology: Methodology) {
  if (methodology === "agile" || methodology === "kanban") {
    return false;
  }

  return sprints.slice(0, sprintIndex).some((sprint) => normalizeSprintStatus(sprint.status) !== "done");
}

export function getDueState(task: TrackerTask) {
  if (!task.due_date || normalizeTaskStatus(task.status) === "done") {
    return "none";
  }

  const today = startOfDay(new Date());
  const due = parseISO(task.due_date);

  if (isBefore(due, today)) {
    return "overdue";
  }

  if (isWithinInterval(due, { start: today, end: addDays(today, 3) }) || isSameDay(due, today)) {
    return "soon";
  }

  return "none";
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return "No due date";
  }

  return format(parseISO(value), "MMM d");
}
