import { NextResponse } from "next/server";
import { canManage, errorResponse, getAuthenticatedSupabase, getMembership } from "@/app/api/tracker/tracker-api-utils";

type RouteProps = {
  params: { sprintId: string } | Promise<{ sprintId: string }>;
};

export async function POST(_request: Request, { params }: RouteProps) {
  const { sprintId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const { data: sprint } = await auth.supabase
    .from("sprints")
    .select("id, group_id, start_date")
    .eq("id", sprintId)
    .maybeSingle();

  if (!sprint) {
    return errorResponse("Sprint not found.", 404);
  }

  const membership = await getMembership(auth.supabase, sprint.group_id, auth.user.id);
  if (!canManage(membership?.role)) {
    return errorResponse("Only the PM can complete phases.", 403);
  }

  const { error: sprintError } = await auth.supabase.from("sprints").update({ status: "done" }).eq("id", sprintId);
  if (sprintError) {
    return errorResponse(sprintError.message, 400);
  }

  const { data: nextSprint } = await auth.supabase
    .from("sprints")
    .select("id, status")
    .eq("group_id", sprint.group_id)
    .gt("start_date", sprint.start_date)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextSprint && nextSprint.status !== "done") {
    await auth.supabase.from("sprints").update({ status: "active" }).eq("id", nextSprint.id);
  }

  return NextResponse.json({ ok: true, unlockedSprintId: nextSprint?.id ?? null });
}
