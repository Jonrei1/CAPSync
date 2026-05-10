import { NextResponse } from "next/server";
import { canManage, errorResponse, getAuthenticatedSupabase, getMembership, isPlainObject } from "@/app/api/tracker/tracker-api-utils";

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  if (!isPlainObject(body) || typeof body.groupId !== "string") {
    return errorResponse("Missing groupId.", 400);
  }

  const membership = await getMembership(auth.supabase, body.groupId, auth.user.id);
  if (!canManage(membership?.role)) return errorResponse("Only the PM can create sprints.", 403);

  const { data, error } = await auth.supabase
    .from("sprints")
    .insert({
      group_id: body.groupId,
      title: typeof body.title === "string" ? body.title.trim() : "New Sprint",
      goal: typeof body.goal === "string" ? body.goal.trim() : "",
      start_date: typeof body.start_date === "string" ? body.start_date : new Date().toISOString().slice(0, 10),
      end_date: typeof body.end_date === "string" ? body.end_date : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: "upcoming",
      ai_generated: false,
    })
    .select("*")
    .single();

  if (error) return errorResponse(error.message, 400);
  return NextResponse.json({ sprint: data });
}
