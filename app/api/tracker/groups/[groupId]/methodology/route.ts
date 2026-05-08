import { NextResponse } from "next/server";
import {
  canManage,
  errorResponse,
  getAuthenticatedSupabase,
  getMembership,
  isPlainObject,
  VALID_METHODS,
} from "@/app/api/tracker/tracker-api-utils";
import type { Methodology } from "@/types";

type RouteProps = {
  params: { groupId: string } | Promise<{ groupId: string }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  const { groupId } = await Promise.resolve(params);
  const auth = await getAuthenticatedSupabase();
  if (auth.response) {
    return auth.response;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isPlainObject(body) || typeof body.methodology !== "string" || !VALID_METHODS.includes(body.methodology as Methodology)) {
    return errorResponse("Invalid methodology.", 400);
  }

  const membership = await getMembership(auth.supabase, groupId, auth.user.id);
  if (!canManage(membership?.role)) {
    return errorResponse("Only the PM can change methodology.", 403);
  }

  const { data, error } = await auth.supabase
    .from("groups")
    .update({ methodology: body.methodology })
    .eq("id", groupId)
    .select("id, methodology")
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  return NextResponse.json({ group: data });
}
