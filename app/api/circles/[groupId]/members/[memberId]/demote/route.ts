import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabaseServer"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function POST(
  _: Request,
  { params }: { params: Promise<{ groupId: string; memberId: string }> },
) {
  const { groupId, memberId } = await params

  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if requester is PM/admin/owner
  const { data: requesterMembership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("member_id", user.id)
    .maybeSingle()

  const requesterRole = (requesterMembership?.role ?? "").toLowerCase()
  if (!["pm", "copm", "admin", "owner"].includes(requesterRole)) {
    return NextResponse.json(
      { error: "Only PM can demote members" },
      { status: 403 },
    )
  }

  // Get target member info
  const { data: targetMembership } = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("member_id", memberId)
    .maybeSingle()

  if (!targetMembership) {
    return NextResponse.json(
      { error: "Member not found in circle" },
      { status: 404 },
    )
  }

  const targetRole = (targetMembership.role ?? "").toLowerCase()

  // Can only demote co-pm to member
  if (targetRole !== "copm") {
    return NextResponse.json(
      { error: "Can only demote Co-PM members" },
      { status: 400 },
    )
  }

  // Update member role to member
  const { error: updateError } = await supabaseAdmin
    .from("group_members")
    .update({ role: "member" })
    .eq("group_id", groupId)
    .eq("member_id", memberId)

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    message: "Member demoted successfully",
  })
}
