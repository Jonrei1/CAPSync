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

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(body)) {
    return errorResponse("Invalid request body.", 400);
  }

  const groupId = typeof body.groupId === "string" ? body.groupId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const status = typeof body.status === "string" && VALID_TASK_STATUSES.includes(body.status as never) ? body.status : "todo";
  const assignedTo = typeof body.assignedTo === "string" && body.assignedTo ? body.assignedTo : null;
  const sprintId = typeof body.sprintId === "string" && body.sprintId ? body.sprintId : null;

  if (!groupId || !title) {
    return errorResponse("Missing groupId or title.", 400);
  }

  const membership = await getMembership(auth.supabase, groupId, auth.user.id);
  if (!membership) {
    return errorResponse("Forbidden.", 403);
  }

  const { data: lastTask } = await auth.supabase
    .from("tasks")
    .select("position")
    .eq("group_id", groupId)
    .order("position", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = typeof lastTask?.position === "number" ? lastTask.position + 1 : 1;
  const requiresApproval = Boolean(assignedTo && assignedTo !== auth.user.id && !canManage(membership.role));

  const { data, error } = await auth.supabase
    .from("tasks")
    .insert({
      group_id: groupId,
      sprint_id: sprintId,
      created_by: auth.user.id,
      assigned_to: assignedTo,
      title,
      description: typeof body.description === "string" ? body.description : null,
      status,
      category: typeof body.category === "string" ? body.category : null,
      due_date: typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null,
      priority: typeof body.priority === "string" ? body.priority : "medium",
      requires_pm_approval: requiresApproval,
      position: nextPosition,
    })
    .select("*")
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  try {
    const { data: groupRow } = await auth.supabase.from("groups").select("name, color").eq("id", groupId).single();
    const actorName = await getActorName(auth.supabase, auth.user.id);

    await writeTaskNotification({
      supabase: auth.supabase,
      groupId,
      groupName: groupRow?.name ?? "Circle",
      groupColor: groupRow?.color ?? "#4f46e5",
      taskId: data.id,
      sprintId: data.sprint_id,
      taskTitle: title,
      event: "created",
      actorName,
      actorId: auth.user.id,
      assignedMemberId: assignedTo,
      dueDate: data.due_date,
    });
  } catch (notificationError) {
    console.error("[tasks POST notification] failed:", notificationError);
  }

  return NextResponse.json({ task: data });
}
