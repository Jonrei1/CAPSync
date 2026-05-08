import type { Profile, TrackerTask } from "@/types";

export type CalendarTaskEvent = {
  id: string;
  task: TrackerTask;
  date: string;
  label: string;
  assignedTo: string | null;
  assigneeColor: string;
  isDeadline: boolean;
  isAllDay: boolean;
};

const FALLBACK_COLORS = ["#4f46e5", "#16a34a", "#ea580c", "#9333ea"] as const;

function dateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}

export function getTasksForCalendar(tasks: TrackerTask[], members: Profile[] = []) {
  const membersById = new Map(members.map((member, index) => [member.id, member.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]]));

  return tasks.flatMap((task): CalendarTaskEvent[] => {
    const color = task.assigned_to ? membersById.get(task.assigned_to) ?? FALLBACK_COLORS[0] : "#71717a";
    const events: CalendarTaskEvent[] = [];
    const startsAt = dateOnly(task.starts_at);
    const endsAt = dateOnly(task.ends_at);
    const dueDate = dateOnly(task.due_date);

    if (startsAt) {
      events.push({
        id: `${task.id}-start`,
        task,
        date: startsAt,
        label: task.title,
        assignedTo: task.assigned_to,
        assigneeColor: color,
        isDeadline: false,
        isAllDay: task.is_all_day,
      });
    }

    if (endsAt && endsAt !== startsAt) {
      events.push({
        id: `${task.id}-end`,
        task,
        date: endsAt,
        label: task.title,
        assignedTo: task.assigned_to,
        assigneeColor: color,
        isDeadline: false,
        isAllDay: task.is_all_day,
      });
    }

    if (dueDate) {
      events.push({
        id: `${task.id}-due`,
        task,
        date: dueDate,
        label: task.title,
        assignedTo: task.assigned_to,
        assigneeColor: color,
        isDeadline: true,
        isAllDay: true,
      });
    }

    return events;
  });
}
