import { NextResponse } from "next/server";
import {
  canManage,
  errorResponse,
  getAuthenticatedSupabase,
  getMembership,
  isPlainObject,
  VALID_TASK_STATUSES,
} from "@/app/api/tracker/tracker-api-utils";
import { getActorName } from "@/lib/notifications/getActorName";
import { writeTaskNotification } from "@/lib/notifications/writeTaskNotification";
import type { TaskStatus } from "@/types";

type RouteProps = {
  params: { taskId: string } | Promise<{ taskId: string }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  const { taskId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(body)) {
    return errorResponse("Invalid request body.", 400);
  }

  const { data: task } = await auth.supabase.from("tasks").select("id, group_id, sprint_id").eq("id", taskId).maybeSingle();
  if (!task) {
    return errorResponse("Task not found.", 404);
  }

  const membership = await getMembership(auth.supabase, task.group_id, auth.user.id);
  if (!membership) {
    return errorResponse("Forbidden.", 403);
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    edited_by: auth.user.id,
  };

  if (typeof body.title === "string") {
    updates.title = body.title.trim();
  }
  if (typeof body.description === "string" || body.description === null) {
    updates.description = body.description;
  }
  if (typeof body.status === "string" && VALID_TASK_STATUSES.includes(body.status as TaskStatus)) {
    updates.status = body.status;
  }
  if (typeof body.assignedTo === "string" || body.assignedTo === null) {
    updates.assigned_to = body.assignedTo;
    if (body.assignedTo && body.assignedTo !== auth.user.id && !canManage(membership.role)) {
      updates.requires_pm_approval = true;
    }
  }
  if (typeof body.sprintId === "string" || body.sprintId === null) {
    updates.sprint_id = body.sprintId;
  }
  if (typeof body.dueDate === "string" || body.dueDate === null) {
    updates.due_date = body.dueDate;
  }
  if (typeof body.category === "string" || body.category === null) {
    updates.category = body.category;
  }
  if (typeof body.priority === "string") {
    updates.priority = body.priority;
  }

  const { data, error } = await auth.supabase.from("tasks").update(updates).eq("id", taskId).select("*").single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  try {
    const { data: groupRow } = await auth.supabase
      .from("groups")
      .select("name, color")
      .eq("id", task.group_id)
      .single();

    const actorName = await getActorName(auth.supabase, auth.user.id);

    let event: Parameters<typeof writeTaskNotification>[0]["event"] | null = null;
    let detail: string | undefined;

    if (typeof body.status === "string") {
      event = "status_changed";
      detail = typeof data.status === "string" ? data.status : undefined;
    } else if ("assignedTo" in body) {
      event = "reassigned";
    } else if ("dueDate" in body) {
      event = "due_date_changed";
      detail = typeof body.dueDate === "string" && body.dueDate ? body.dueDate : "cleared";
    }

    if (event) {
      await writeTaskNotification({
        supabase: auth.supabase,
        groupId: task.group_id,
        groupName: groupRow?.name ?? "Circle",
        groupColor: groupRow?.color ?? "#4f46e5",
        taskId: data.id,
        sprintId: data.sprint_id,
        taskTitle: data.title,
        event,
        actorName,
        actorId: auth.user.id,
        assignedMemberId: event === "reassigned" ? (typeof body.assignedTo === "string" && body.assignedTo ? body.assignedTo : null) : null,
        detail,
        dueDate: data.due_date,
      });
    }
  } catch (notificationError) {
    console.error("[tasks PATCH notification] failed:", notificationError);
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const { taskId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const { data: task } = await auth.supabase
    .from("tasks")
    .select("id, group_id, created_by, title")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) {
    return errorResponse("Task not found.", 404);
  }

  // Only the creator can delete the task
  if (task.created_by !== auth.user.id) {
    return errorResponse("Only the task creator can delete this task.", 403);
  }

  const membership = await getMembership(auth.supabase, task.group_id, auth.user.id);
  if (!membership) {
    return errorResponse("Forbidden.", 403);
  }

  try {
    const { data: groupRow } = await auth.supabase.from("groups").select("name, color").eq("id", task.group_id).single();
    const actorName = await getActorName(auth.supabase, auth.user.id);

    await writeTaskNotification({
      supabase: auth.supabase,
      groupId: task.group_id,
      groupName: groupRow?.name ?? "Circle",
      groupColor: groupRow?.color ?? "#4f46e5",
      taskId: task.id,
      sprintId: task.sprint_id,
      taskTitle: task.title,
      event: "deleted",
      actorName,
      actorId: auth.user.id,
    });
  } catch (notificationError) {
    console.error("[tasks DELETE notification] failed:", notificationError);
  }

  const { error } = await auth.supabase.from("tasks").delete().eq("id", taskId);

  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ success: true });
}
