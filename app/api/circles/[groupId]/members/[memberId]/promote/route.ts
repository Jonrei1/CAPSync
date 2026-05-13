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
  const membershipRes = await client
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("member_id", userId)
    .maybeSingle();

  const role = (membershipRes?.data as { role?: string } | null)?.role ?? null;

  if (!role || !["pm", "copm", "owner", "admin"].includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Promote the specified member to co-pm (role = 'copm')
  const { error } = await supabaseAdmin
    .from("group_members")
    .update({ role: "copm" })
    .eq("group_id", groupId)
    .eq("member_id", memberId);

  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
