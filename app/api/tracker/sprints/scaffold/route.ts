import { NextResponse } from "next/server";
import { buildThesisSprints } from "@/lib/tracker/defaultSprints";
import { canManage, errorResponse, getAuthenticatedSupabase, getMembership, isPlainObject } from "@/app/api/tracker/tracker-api-utils";

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  if (!isPlainObject(body) || typeof body.groupId !== "string" || typeof body.startDate !== "string") {
    return errorResponse("Missing groupId or startDate.", 400);
  }

  const membership = await getMembership(auth.supabase, body.groupId, auth.user.id);
  if (!canManage(membership?.role)) return errorResponse("Only the PM can scaffold sprints.", 403);

  const presets = buildThesisSprints(new Date(body.startDate));
  const rows = presets.map((p) => ({
    group_id: body.groupId,
    title: p.title,
    goal: p.goal,
    start_date: p.start_date,
    end_date: p.end_date,
    status: "upcoming",
    ai_generated: false,
  }));

  const { data, error } = await auth.supabase.from("sprints").insert(rows).select("*");
  if (error) return errorResponse(error.message, 400);
  return NextResponse.json({ sprints: data });
}
