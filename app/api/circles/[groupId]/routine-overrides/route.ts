import { NextResponse } from "next/server";
import {
  errorResponse,
  getAuthenticatedSupabase,
  getMembership,
  isPlainObject,
} from "@/app/api/tracker/tracker-api-utils";

type RouteProps = {
  params: { groupId: string } | Promise<{ groupId: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const { groupId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const membership = await getMembership(auth.supabase, groupId, auth.user.id);
  if (!membership) {
    return errorResponse("Forbidden.", 403);
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(body)) {
    return errorResponse("Invalid request body.", 400);
  }

  const personalRoutineId = typeof body.personal_routine_id === "string" ? body.personal_routine_id : "";
  if (!personalRoutineId) {
    return errorResponse("Missing personal routine id.", 400);
  }

  const hidden = body.hidden === true;
  const payload: Record<string, unknown> = {
    group_id: groupId,
    personal_routine_id: personalRoutineId,
    user_id: auth.user.id,
    hidden,
    updated_at: new Date().toISOString(),
  };

  if (!hidden) {
    if (typeof body.label === "string") {
      payload.label = body.label.trim();
    }
    if (typeof body.details === "string" || body.details === null) {
      payload.details = body.details;
    }
    if (typeof body.color === "string") {
      payload.color = body.color;
    }
    if (Array.isArray(body.days_of_week)) {
      payload.days_of_week = body.days_of_week.filter((value): value is number => typeof value === "number" && Number.isInteger(value));
    }
    if (typeof body.start_time === "string") {
      payload.start_time = body.start_time;
    }
    if (typeof body.end_time === "string") {
      payload.end_time = body.end_time;
    }
  }

  const { data, error } = await auth.supabase
    .from("circle_routine_overrides")
    .upsert(payload, { onConflict: "group_id,personal_routine_id,user_id" })
    .select("id, group_id, personal_routine_id, user_id, hidden, label, details, color, days_of_week, start_time, end_time")
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ override: data });
}