import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityNotification } from "./writeActivityNotification";

export type TaskNotificationEvent =
  | "created"
  | "status_changed"
  | "reassigned"
  | "due_date_changed"
  | "commented"
  | "deleted";

type WriteTaskNotificationInput = {
  supabase: SupabaseClient;
  groupId: string;
  groupName: string;
  groupColor: string;
  taskId: string;
  taskTitle: string;
  event: TaskNotificationEvent;
  actorName: string;
  actorId?: string | null;
  assignedMemberId?: string | null;
  /** Extra detail appended to the title, e.g. new status or assignee name */
  detail?: string;
  dueDate?: string | null;
};

const EVENT_LABEL: Record<TaskNotificationEvent, string> = {
  created: "New task created",
  status_changed: "Task status updated",
  reassigned: "You've been assigned a task",
  due_date_changed: "Task due date changed",
  commented: "New comment on task",
  deleted: "Task deleted",
};

export async function writeTaskNotification(input: WriteTaskNotificationInput): Promise<void> {
  const { data: memberRows, error } = await input.supabase
    .from("group_members")
    .select("member_id")
    .eq("group_id", input.groupId);

  if (error) {
    console.error("[writeTaskNotification] recipient lookup failed:", error.message);
    return;
  }

  const memberIds = memberRows?.map((row: { member_id: string }) => row.member_id) ?? [];
  let recipientIds: string[] = [];

  if (input.event === "created") {
    if (input.assignedMemberId) {
      recipientIds = [input.assignedMemberId];
    } else {
      recipientIds = memberIds.filter((memberId) => memberId !== input.actorId);
    }
  } else if (input.event === "reassigned") {
    recipientIds = input.assignedMemberId ? [input.assignedMemberId] : [];
  } else {
    recipientIds = memberIds.filter((memberId) => memberId !== input.actorId);
  }

  if (!recipientIds.length) {
    return;
  }

  const label = EVENT_LABEL[input.event];
  let title = input.detail ? `${label}: "${input.taskTitle}" → ${input.detail}` : `${label}: "${input.taskTitle}"`;

  if (input.event === "created") {
    title = input.assignedMemberId
      ? `A new task has been assigned to you: "${input.taskTitle}"`
      : `New task created: "${input.taskTitle}"`;
  } else if (input.event === "reassigned") {
    title = `You've been assigned a task: "${input.taskTitle}"`;
  }

  await writeActivityNotification({
    supabase: input.supabase,
    recipientIds,
    groupId: input.groupId,
    groupName: input.groupName,
    groupColor: input.groupColor,
    type: "task",
    title,
    eventDate: input.dueDate ?? new Date().toISOString().slice(0, 10),
    link: `/${input.groupId}/tracker`,
    createdByName: input.actorName,
  });
}