import { NextResponse } from "next/server";
import { errorResponse, getAuthenticatedSupabase, getMembership, isPlainObject } from "@/app/api/tracker/tracker-api-utils";
import { getActorName } from "@/lib/notifications/getActorName";
import { writeTaskNotification } from "@/lib/notifications/writeTaskNotification";

type RouteProps = {
  params: { taskId: string } | Promise<{ taskId: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const { taskId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(body) || typeof body.body !== "string" || !body.body.trim()) {
    return errorResponse("Comment body is required.", 400);
  }

  const { data: task } = await auth.supabase.from("tasks").select("group_id").eq("id", taskId).maybeSingle();
  if (!task) {
    return errorResponse("Task not found.", 404);
  }

  const membership = await getMembership(auth.supabase, task.group_id, auth.user.id);
  if (!membership) {
    return errorResponse("Forbidden.", 403);
  }

  const { data, error } = await auth.supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      author_id: auth.user.id,
      body: body.body.trim(),
    })
    .select("*")
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  try {
    const { data: taskRow } = await auth.supabase.from("tasks").select("group_id, title, due_date").eq("id", taskId).single();

    if (taskRow) {
      const { data: groupRow } = await auth.supabase
        .from("groups")
        .select("name, color")
        .eq("id", taskRow.group_id)
        .single();

      const actorName = await getActorName(auth.supabase, auth.user.id);

      await writeTaskNotification({
        supabase: auth.supabase,
        groupId: taskRow.group_id,
        groupName: groupRow?.name ?? "Circle",
        groupColor: groupRow?.color ?? "#4f46e5",
        taskId,
        taskTitle: taskRow.title,
        event: "commented",
        actorName,
        dueDate: taskRow.due_date,
      });
    }
  } catch (notificationError) {
    console.error("[tasks comment notification] failed:", notificationError);
  }

  return NextResponse.json({ comment: data });
}
