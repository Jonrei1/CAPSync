import { NextResponse } from "next/server";
import {
  canManage,
  errorResponse,
  getAuthenticatedSupabase,
  getMembership,
  isPlainObject,
  VALID_METHODS,
} from "@/app/api/tracker/tracker-api-utils";
import { getActorName } from "@/lib/notifications/getActorName";
import { writeActivityNotification } from "@/lib/notifications/writeActivityNotification";
import type { Methodology } from "@/types";
import { METHODOLOGIES } from "@/components/tracker/tracker-utils";

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
    .select("id, name, color, methodology")
    .single();

  if (error) {
    return errorResponse(error.message, 400);
  }

  try {
    const { data: memberRows } = await auth.supabase.from("group_members").select("member_id").eq("group_id", groupId);
    const recipientIds = memberRows?.map((row: { member_id: string }) => row.member_id) ?? [];

    if (recipientIds.length > 0) {
      const actorName = await getActorName(auth.supabase, auth.user.id);
      const methodologyLabel = METHODOLOGIES[data.methodology as Methodology].name;

      await writeActivityNotification({
        supabase: auth.supabase,
        recipientIds,
        groupId,
        groupName: data.name ?? "Circle",
        groupColor: data.color ?? "#4f46e5",
        type: "task",
        title: `Methodology changed to ${methodologyLabel}: workflow and sprint rules have been updated`,
        eventDate: new Date().toISOString().slice(0, 10),
        link: `/${groupId}/tracker`,
        createdByName: actorName,
      });
    }
  } catch (notificationError) {
    console.error("[methodology PATCH notification] failed:", notificationError);
  }

  return NextResponse.json({ group: data });
}
