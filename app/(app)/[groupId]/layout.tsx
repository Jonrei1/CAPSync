import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";

type CircleLayoutProps = {
  children: ReactNode;
  params: { groupId: string } | Promise<{ groupId: string }>;
};

export default async function CircleLayout({ children, params }: CircleLayoutProps) {
  const { groupId } = await Promise.resolve(params);

  if (!groupId) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("member_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    notFound();
  }

  return <>{children}</>;
}
