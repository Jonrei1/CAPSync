import { NextResponse } from "next/server";
import {
  canManage,
  errorResponse,
  getAuthenticatedSupabase,
  getMembership,
  isPlainObject,
  VALID_TASK_STATUSES,
} from "@/app/api/tracker/tracker-api-utils";
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

  const { data: task } = await auth.supabase.from("tasks").select("id, group_id").eq("id", taskId).maybeSingle();
  if (!task) {
    return errorResponse("Task not found.", 404);
  }

  const membership = await getMembership(auth.supabase, task.group_id, auth.user.id);
  if (!membership) {
    return errorResponse("Forbidden.", 403);
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
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

  return NextResponse.json({ task: data });
}
