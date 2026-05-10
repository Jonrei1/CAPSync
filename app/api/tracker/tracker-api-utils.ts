import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabaseServer";
import type { Methodology, TaskStatus } from "@/types";

export const VALID_METHODS: Methodology[] = ["simple", "scrum", "agile", "kanban"];
export const VALID_TASK_STATUSES: TaskStatus[] = ["todo", "doing", "review", "done", "blocked"];
export const MANAGER_ROLES = new Set(["pm", "admin", "owner"]);

export function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getAuthenticatedSupabase(): Promise<
  | {
      supabase: SupabaseClient;
      user: User;
      response?: never;
    }
  | {
      supabase?: never;
      user?: never;
      response: NextResponse;
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: errorResponse("Unauthorized.", 401) };
  }

  return { supabase, user };
}

export async function getMembership(supabase: SupabaseClient, groupId: string, userId: string) {
  const { data } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("member_id", userId)
    .maybeSingle();

  return data as { role: string | null } | null;
}

export function canManage(role: string | null | undefined) {
  return MANAGER_ROLES.has(role ?? "");
}
