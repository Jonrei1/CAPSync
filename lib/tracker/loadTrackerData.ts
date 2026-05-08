import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import type { Comment, Group, Profile, Sprint, Task, TrackerComment, TrackerSprint, TrackerTask, User } from "@/types";

type MemberRow = {
  member_id: string;
  role: string | null;
  color: string | null;
  profiles:
    | {
        id: string;
        full_name: string | null;
        email: string | null;
        created_at?: string | null;
      }
    | Array<{
        id: string;
        full_name: string | null;
        email: string | null;
        created_at?: string | null;
      }>
    | null;
};

type CommentRow = Comment & {
  profiles?:
    | {
        id: string;
        full_name: string | null;
        email: string | null;
        created_at?: string | null;
      }
    | Array<{
        id: string;
        full_name: string | null;
        email: string | null;
        created_at?: string | null;
      }>
    | null;
};

const FALLBACK_MEMBER_COLORS = ["#4f46e5", "#16a34a", "#ea580c", "#9333ea"] as const;

function firstProfile(row: MemberRow | CommentRow) {
  const profile = row.profiles;
  return Array.isArray(profile) ? profile[0] ?? null : profile ?? null;
}

function mapUser(profile: ReturnType<typeof firstProfile> | null | undefined): User | null {
  if (!profile?.id) {
    return null;
  }

  return {
    id: profile.id,
    full_name: profile.full_name ?? null,
    email: profile.email ?? null,
    created_at: profile.created_at ?? "",
  };
}

function createBacklogSprint(groupId: string): TrackerSprint {
  return {
    id: "__backlog",
    group_id: groupId,
    title: "Backlog",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    goal: "Tasks that are not assigned to a sprint or phase yet.",
    status: "active",
    ai_generated: false,
    created_at: "",
    tasks: [],
  };
}

export async function loadTrackerData(groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("member_id", user.id)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  const [groupResult, membersResult, sprintsResult, tasksResult] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, color, methodology, created_by, created_at, archived_at, subject, invite_code")
      .eq("id", groupId)
      .maybeSingle(),
    supabase
      .from("group_members")
      .select("member_id, role, color, profiles(id, full_name, email, created_at)")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true }),
    supabase.from("sprints").select("*").eq("group_id", groupId).order("start_date", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("group_id", groupId)
      .order("position", { ascending: true, nullsFirst: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  if (!groupResult.data) {
    notFound();
  }

  const members = ((membersResult.data ?? []) as MemberRow[]).map((row, index): Profile => {
    const profile = firstProfile(row);
    return {
      id: profile?.id ?? row.member_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      created_at: profile?.created_at ?? "",
      role: row.role,
      color: row.color ?? FALLBACK_MEMBER_COLORS[index % FALLBACK_MEMBER_COLORS.length],
    };
  });

  const membersById = new Map(members.map((member) => [member.id, member]));
  const rawTasks = (tasksResult.data ?? []) as Task[];
  const rawSprints = (sprintsResult.data ?? []) as Sprint[];
  const taskIds = rawTasks.map((task) => task.id);

  const commentsResult =
    taskIds.length > 0
      ? await supabase
          .from("task_comments")
          .select("*, profiles(id, full_name, email, created_at)")
          .in("task_id", taskIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

  const commentsByTask = new Map<string, TrackerComment[]>();
  ((commentsResult.data ?? []) as CommentRow[]).forEach((comment) => {
    const mapped: TrackerComment = {
      ...comment,
      author: mapUser(firstProfile(comment)),
    };
    const next = commentsByTask.get(comment.task_id) ?? [];
    next.push(mapped);
    commentsByTask.set(comment.task_id, next);
  });

  const tasks = rawTasks.map((task): TrackerTask => {
    const assignee = task.assigned_to ? membersById.get(task.assigned_to) : null;
    return {
      ...task,
      starts_at: task.starts_at ?? null,
      ends_at: task.ends_at ?? null,
      is_all_day: task.is_all_day ?? false,
      assignee: assignee
        ? {
            id: assignee.id,
            full_name: assignee.full_name,
            email: assignee.email,
            created_at: assignee.created_at,
          }
        : null,
      comments: commentsByTask.get(task.id) ?? [],
    };
  });

  const sprintMap = new Map<string, TrackerSprint>();
  rawSprints.forEach((sprint) => {
    sprintMap.set(sprint.id, { ...sprint, tasks: [] });
  });

  const backlog = createBacklogSprint(groupId);
  tasks.forEach((task) => {
    const sprint = task.sprint_id ? sprintMap.get(task.sprint_id) : null;
    if (sprint) {
      sprint.tasks.push(task);
      return;
    }

    backlog.tasks.push(task);
  });

  const sprints = [...sprintMap.values()];
  if (backlog.tasks.length > 0 || sprints.length === 0) {
    sprints.push(backlog);
  }

  const role = typeof membership.role === "string" ? membership.role : "member";

  return {
    group: groupResult.data as Group,
    members,
    sprints,
    tasks,
    currentUserId: user.id,
    currentUserRole: role,
    canManage: role === "pm" || role === "admin" || role === "owner",
  };
}
