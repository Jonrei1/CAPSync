import { NextResponse } from "next/server";
import { errorResponse, getAuthenticatedSupabase, getMembership, isPlainObject } from "@/app/api/tracker/tracker-api-utils";

type RouteProps = {
  params:
    | { taskId: string; commentId: string }
    | Promise<{ taskId: string; commentId: string }>;
};

async function verifyTaskMembership(taskId: string, userId: string) {
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return { auth };
  }

  const { data: task } = await auth.supabase.from("tasks").select("id, group_id").eq("id", taskId).maybeSingle();
  if (!task) {
    return { auth, response: errorResponse("Task not found.", 404) };
  }

  const membership = await getMembership(auth.supabase, task.group_id, userId);
  if (!membership) {
    return { auth, response: errorResponse("Forbidden.", 403) };
  }

  return { auth, task };
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const { taskId, commentId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const membershipCheck = await verifyTaskMembership(taskId, auth.user.id);
  if (membershipCheck.response) {
    return membershipCheck.response;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(body) || typeof body.body !== "string" || !body.body.trim()) {
    return errorResponse("Comment body is required.", 400);
  }

  const { data: existing } = await auth.supabase
    .from("task_comments")
    .select("id, author_id, task_id")
    .eq("id", commentId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (!existing) {
    return errorResponse("Comment not found.", 404);
  }

  if (existing.author_id !== auth.user.id) {
    return errorResponse("Only the comment creator can edit this comment.", 403);
  }

  const { data, error } = await auth.supabase
    .from("task_comments")
    .update({ body: body.body.trim() })
    .eq("id", commentId)
    .eq("task_id", taskId)
    .select("*")
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ comment: data });
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  const { taskId, commentId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const membershipCheck = await verifyTaskMembership(taskId, auth.user.id);
  if (membershipCheck.response) {
    return membershipCheck.response;
  }

  const { data: existing } = await auth.supabase
    .from("task_comments")
    .select("id, author_id, task_id")
    .eq("id", commentId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (!existing) {
    return errorResponse("Comment not found.", 404);
  }

  if (existing.author_id !== auth.user.id) {
    return errorResponse("Only the comment creator can delete this comment.", 403);
  }

  const { error } = await auth.supabase
    .from("task_comments")
    .delete()
    .eq("id", commentId)
    .eq("task_id", taskId);

  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ ok: true });
}