import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(_: Request, { params }: { params: Promise<{ groupId: string; memberId: string }> }) {
  const { groupId, memberId } = await params;

  const client = await createClient();
  const { data: authData } = await client.auth.getUser();
  const userId = authData.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // Verify requester is a pm/owner/admin
  const { data: membership } = await client
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("member_id", userId)
    .maybeSingle();

  const role = (membership as any)?.role ?? null;

  if (!role || !["pm", "copm", "owner", "admin"].includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Prevent removing the owner
  const { data: targetMembership } = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("member_id", memberId)
    .maybeSingle();

  const targetRole = (targetMembership as any)?.role ?? null;
  if (targetRole === "owner") {
    return NextResponse.json({ error: "cannot_remove_owner" }, { status: 403 });
  }

  // Remove the member
  const { error } = await supabaseAdmin
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("member_id", memberId);

  if (error) {
    return NextResponse.json({ error: "delete_failed", detail: error.message }, { status: 500 });
  }

  // Notify all remaining members
  const { data: memberRows } = await supabaseAdmin
    .from("group_members")
    .select("member_id")
    .eq("group_id", groupId);

  const recipientIds = (memberRows ?? [])
    .map((r: any) => r.member_id)
    .filter(Boolean);

  const { data: groupRow } = await supabaseAdmin
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .maybeSingle();

  if (recipientIds.length > 0 && groupRow) {
    const targetMemberProfile = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", memberId)
      .maybeSingle();

    const removedName = targetMemberProfile?.data?.full_name ?? "A member";

    const rows = recipientIds.map((uid: string) => ({
      user_id: uid,
      group_id: groupId,
      group_name: groupRow.name,
      group_color: null,
      type: "task",
      title: `${removedName} was removed from ${groupRow.name}`,
      event_date: new Date().toISOString().slice(0, 10),
      event_start_hour: null,
      event_end_hour: null,
      link: `/${groupId}/calendar`,
      created_by_name: "system",
      read_at: null,
    }));

    await supabaseAdmin.from("activity_notifications").insert(rows);
  }

  return NextResponse.json({ ok: true });
}
