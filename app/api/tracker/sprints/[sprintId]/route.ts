import { NextResponse } from "next/server";
import { canManage, errorResponse, getAuthenticatedSupabase, getMembership, isPlainObject } from "@/app/api/tracker/tracker-api-utils";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteProps = {
  params: { sprintId: string } | Promise<{ sprintId: string }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  const { sprintId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  if (!isPlainObject(body)) return errorResponse("Invalid body.", 400);

  const { data: sprint } = await auth.supabase
    .from("sprints")
    .select("id, group_id")
    .eq("id", sprintId)
    .maybeSingle();
  if (!sprint) return errorResponse("Sprint not found.", 404);

  const membership = await getMembership(auth.supabase, sprint.group_id, auth.user.id);
  if (!canManage(membership?.role)) return errorResponse("Only the PM can edit sprints.", 403);

  const updates: Record<string, unknown> = {};
  if (typeof body.start_date === "string") updates.start_date = body.start_date;
  if (typeof body.end_date === "string") updates.end_date = body.end_date;
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.goal === "string") updates.goal = body.goal.trim();

  if (
    updates.start_date &&
    updates.end_date &&
    new Date(updates.end_date as string) < new Date(updates.start_date as string)
  ) {
    return errorResponse("End date must be after start date.", 400);
  }

  const { data, error } = await auth.supabase
    .from("sprints")
    .update(updates)
    .eq("id", sprintId)
    .select("*")
    .single();
  if (error) return errorResponse(error.message, 400);
  return NextResponse.json({ sprint: data });
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const { sprintId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) return auth.response;

  const { data: sprint } = await auth.supabase
    .from("sprints")
    .select("id, group_id")
    .eq("id", sprintId)
    .maybeSingle();
  if (!sprint) return errorResponse("Sprint not found.", 404);

  const membership = await getMembership(auth.supabase, sprint.group_id, auth.user.id);
  if (!canManage(membership?.role)) return errorResponse("Only the PM can delete sprints.", 403);

  const { error } = await supabaseAdmin
    .from("sprints")
    .delete()
    .eq("id", sprintId);
  if (error) return errorResponse(error.message, 400);
  return NextResponse.json({ ok: true });
}
