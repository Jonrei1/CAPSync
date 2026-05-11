import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(_: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  const client = await createClient();
  const { data: authData } = await client.auth.getUser();
  const userId = authData.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // Verify requester is a pm/owner/admin (co-pm is explicitly not allowed to delete)
  const { data: membership } = await client
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("member_id", userId)
    .maybeSingle();

  const role = (membership as any)?.role ?? null;

  if (!role || !["pm", "owner", "admin"].includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Fetch group info and member ids, then notify members and delete.
  const { data: groupRow } = await supabaseAdmin.from("groups").select("id, name").eq("id", groupId).maybeSingle();

  if (!groupRow) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: memberRows } = await supabaseAdmin.from("group_members").select("member_id").eq("group_id", groupId);

  const recipientIds = (memberRows ?? []).map((r: any) => r.member_id).filter(Boolean);

  if (recipientIds.length > 0) {
    const rows = recipientIds.map((userId: string) => ({
      user_id: userId,
      group_id: groupRow.id,
      group_name: groupRow.name,
      group_color: null,
      type: "task",
      title: `Circle deleted: ${groupRow.name}`,
      event_date: new Date().toISOString().slice(0, 10),
      event_start_hour: null,
      event_end_hour: null,
      link: "/dashboard",
      created_by_name: "system",
      read_at: null,
    }));

    await supabaseAdmin.from("activity_notifications").insert(rows);
  }

  await supabaseAdmin.from("groups").delete().eq("id", groupId);

  return NextResponse.json({ ok: true });
}
