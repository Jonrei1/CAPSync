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

export async function GET(_: Request, { params }: RouteProps) {
  const { groupId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const membership = await getMembership(auth.supabase, groupId, auth.user.id);
  if (!membership) {
    return errorResponse("Forbidden.", 403);
  }

  const { data, error } = await auth.supabase
    .from("circle_member_routines")
    .select("id, group_id, user_id, label, details, color, days_of_week, start_time, end_time, is_active, profiles:profiles(full_name)")
    .eq("group_id", groupId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ routines: data ?? [] });
}

export async function POST(request: Request, { params }: RouteProps) {
  const { groupId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(body)) {
    return errorResponse("Invalid request body.", 400);
  }

  const membership = await getMembership(auth.supabase, groupId, auth.user.id);
  if (!membership) {
    return errorResponse("Forbidden.", 403);
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  const color = typeof body.color === "string" && body.color ? body.color : "#374151";
  const startTime = typeof body.start_time === "string" ? body.start_time : "";
  const endTime = typeof body.end_time === "string" ? body.end_time : "";
  const daysOfWeek = Array.isArray(body.days_of_week)
    ? body.days_of_week.filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6)
    : [];

  if (!label || daysOfWeek.length === 0 || !startTime || !endTime) {
    return errorResponse("Missing routine fields.", 400);
  }

  const { data, error } = await auth.supabase
    .from("circle_member_routines")
    .insert({
      group_id: groupId,
      user_id: auth.user.id,
      label,
      details: details || null,
      color,
      days_of_week: daysOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_active: true,
    })
    .select("id, group_id, user_id, label, details, color, days_of_week, start_time, end_time, is_active")
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ routine: data });
}
