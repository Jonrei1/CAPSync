import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskStatus } from "@/types";

type ReorderTaskInput = {
  id: string;
  position: number;
  status?: TaskStatus;
};

export async function reorderTasks(supabase: SupabaseClient, tasks: ReorderTaskInput[]) {
  const results = await Promise.all(
    tasks.map((task) =>
      supabase
        .from("tasks")
        .update({
          position: task.position,
          ...(task.status ? { status: task.status } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id)
        .select("id, position, status")
        .single(),
    ),
  );

  const error = results.find((result) => result.error)?.error;
  if (error) {
    throw error;
  }

  return results.map((result) => result.data);
}
