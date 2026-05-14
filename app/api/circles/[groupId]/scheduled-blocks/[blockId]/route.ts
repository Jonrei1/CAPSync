import { NextResponse } from "next/server";
import {
  errorResponse,
  getAuthenticatedSupabase,
  getMembership,
  isPlainObject,
} from "@/app/api/tracker/tracker-api-utils";

type RouteProps = {
  params: { groupId: string; blockId: string } | Promise<{ groupId: string; blockId: string }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  const { groupId, blockId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(body)) {
    return errorResponse("Invalid request body.", 400);
  }

  const { data: scheduledBlock } = await auth.supabase
    .from("circle_scheduled_blocks")
    .select("id, group_id, user_id")
    .eq("id", blockId)
    .maybeSingle();

  if (!scheduledBlock) {
    return errorResponse("Schedule not found.", 404);
  }

  if (scheduledBlock.group_id !== groupId) {
    return errorResponse("Forbidden.", 403);
  }

  const membership = await getMembership(auth.supabase, groupId, auth.user.id);
  if (!membership || scheduledBlock.user_id !== auth.user.id) {
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
  if (typeof body.scheduled_date === "string") {
    updates.scheduled_date = body.scheduled_date;
  }
  if (typeof body.start_time === "string") {
    updates.start_time = body.start_time;
  }
  if (typeof body.end_time === "string") {
    updates.end_time = body.end_time;
  }

  const { data, error } = await auth.supabase
    .from("circle_scheduled_blocks")
    .update(updates)
    .eq("id", blockId)
    .select("id, group_id, user_id, label, details, color, scheduled_date, start_time, end_time")
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ scheduledBlock: data });
}

export async function DELETE(_: Request, { params }: RouteProps) {
  const { groupId, blockId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const { data: scheduledBlock } = await auth.supabase
    .from("circle_scheduled_blocks")
    .select("id, group_id, user_id")
    .eq("id", blockId)
    .maybeSingle();

  if (!scheduledBlock) {
    return errorResponse("Schedule not found.", 404);
  }

  if (scheduledBlock.group_id !== groupId) {
    return errorResponse("Forbidden.", 403);
  }

  const membership = await getMembership(auth.supabase, groupId, auth.user.id);
  if (!membership || scheduledBlock.user_id !== auth.user.id) {
    return errorResponse("Forbidden.", 403);
  }

  const { error } = await auth.supabase.from("circle_scheduled_blocks").delete().eq("id", blockId);
  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ success: true });
}
