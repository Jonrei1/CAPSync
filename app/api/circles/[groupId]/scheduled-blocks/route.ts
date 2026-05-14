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

export async function GET(request: Request, { params }: RouteProps) {
  const { groupId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const membership = await getMembership(auth.supabase, groupId, auth.user.id);
  if (!membership) {
    return errorResponse("Forbidden.", 403);
  }

  const url = new URL(request.url);
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";

  if (!start || !end) {
    return errorResponse("Missing start or end query parameters.", 400);
  }

  const { data, error } = await auth.supabase
    .from("circle_scheduled_blocks")
    .select("id, group_id, user_id, label, details, color, scheduled_date, start_time, end_time, created_at, updated_at, profiles:profiles(full_name)")
    .eq("group_id", groupId)
    .gte("scheduled_date", start)
    .lte("scheduled_date", end)
    .order("scheduled_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ scheduledBlocks: data ?? [] });
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
  const scheduledDate = typeof body.scheduled_date === "string" ? body.scheduled_date : "";
  const startTime = typeof body.start_time === "string" ? body.start_time : "";
  const endTime = typeof body.end_time === "string" ? body.end_time : "";

  if (!label || !scheduledDate || !startTime || !endTime) {
    return errorResponse("Missing schedule fields.", 400);
  }

  const { data, error } = await auth.supabase
    .from("circle_scheduled_blocks")
    .insert({
      group_id: groupId,
      user_id: auth.user.id,
      label,
      details: details || null,
      color,
      scheduled_date: scheduledDate,
      start_time: startTime,
      end_time: endTime,
    })
    .select("id, group_id, user_id, label, details, color, scheduled_date, start_time, end_time")
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ scheduledBlock: data });
}
