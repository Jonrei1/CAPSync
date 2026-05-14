import { NextResponse } from "next/server";
import {
  errorResponse,
  getAuthenticatedSupabase,
  getMembership,
  isPlainObject,
} from "@/app/api/tracker/tracker-api-utils";

type RouteProps = {
  params: { groupId: string; routineId: string } | Promise<{ groupId: string; routineId: string }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  const { groupId, routineId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(body)) {
    return errorResponse("Invalid request body.", 400);
  }

  const { data: routine } = await auth.supabase
    .from("circle_member_routines")
    .select("id, group_id, user_id")
    .eq("id", routineId)
    .maybeSingle();

  if (!routine) {
    return errorResponse("Routine not found.", 404);
  }

  if (routine.group_id !== groupId) {
    return errorResponse("Forbidden.", 403);
  }

  const membership = await getMembership(auth.supabase, groupId, auth.user.id);
  if (!membership || routine.user_id !== auth.user.id) {
    return errorResponse("Forbidden.", 403);
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.label === "string") {
    updates.label = body.label.trim();
  }
  if (typeof body.details === "string" || body.details === null) {
    updates.details = body.details;
  }
  if (typeof body.color === "string" && body.color) {
    updates.color = body.color;
  }
  if (Array.isArray(body.days_of_week)) {
    updates.days_of_week = body.days_of_week.filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6);
  }
  if (typeof body.start_time === "string") {
    updates.start_time = body.start_time;
  }
  if (typeof body.end_time === "string") {
    updates.end_time = body.end_time;
  }

  const { data, error } = await auth.supabase
    .from("circle_member_routines")
    .update(updates)
    .eq("id", routineId)
    .select("id, group_id, user_id, label, details, color, days_of_week, start_time, end_time, is_active")
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ routine: data });
}

export async function DELETE(_: Request, { params }: RouteProps) {
  const { groupId, routineId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const { data: routine } = await auth.supabase
    .from("circle_member_routines")
    .select("id, group_id, user_id")
    .eq("id", routineId)
    .maybeSingle();

  if (!routine) {
    return errorResponse("Routine not found.", 404);
  }

  if (routine.group_id !== groupId) {
    return errorResponse("Forbidden.", 403);
  }

  const membership = await getMembership(auth.supabase, groupId, auth.user.id);
  if (!membership || routine.user_id !== auth.user.id) {
    return errorResponse("Forbidden.", 403);
  }

  const { error } = await auth.supabase.from("circle_member_routines").delete().eq("id", routineId);
  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ success: true });
}
