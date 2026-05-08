import { NextResponse } from "next/server";
import { errorResponse, getAuthenticatedSupabase, getMembership, isPlainObject } from "@/app/api/tracker/tracker-api-utils";

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

  return NextResponse.json({ comment: data });
}
