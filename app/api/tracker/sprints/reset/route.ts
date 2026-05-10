import { NextResponse } from "next/server";
import { canManage, errorResponse, getAuthenticatedSupabase, getMembership, isPlainObject } from "@/app/api/tracker/tracker-api-utils";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  if (!isPlainObject(body) || typeof body.groupId !== "string") {
    return errorResponse("Missing groupId.", 400);
  }

  const { groupId } = body;
  const membership = await getMembership(auth.supabase, groupId, auth.user.id);
  if (!canManage(membership?.role)) return errorResponse("Only the PM can reset sprints.", 403);

  // Reassign all tasks in the group to backlog (sprint_id = null)
  const { error: taskError } = await supabaseAdmin.from("tasks").update({ sprint_id: null }).eq("group_id", groupId);
  if (taskError) return errorResponse(taskError.message, 400);

  // Delete all persisted sprints for the group; the backlog row is synthetic and not stored in the table.
  const { error: sprintError } = await supabaseAdmin.from("sprints").delete().eq("group_id", groupId);
  if (sprintError) return errorResponse(sprintError.message, 400);

  return NextResponse.json({ ok: true });
}
