import { redirect } from "next/navigation";
import { Suspense } from "react";
import CalendarShell from "@/components/circle-calendar/CalendarShell";
import { createClient } from "@/lib/supabaseServer";
import { computeFreeWindows } from "@/lib/schedule/computeFreeWindows";
import { mergeBlocks } from "@/lib/schedule/mergeBlocks";
import type { CalendarBlock, CalendarDeadline, CalendarMember } from "@/types";

type PageProps = {
  params: { groupId: string } | Promise<{ groupId: string }>;
  searchParams?:
    | { week?: string | string[]; date?: string | string[] }
    | Promise<{ week?: string | string[]; date?: string | string[] }>;
};

type MemberRow = {
  member_id: string;
  role: string | null;
  color?: string | null;
  profiles:
    | {
        id: string;
        full_name?: string | null;
      }
    | Array<{
        id: string;
        full_name?: string | null;
      }>
    | null;
};

type ScheduleRow = {
  id?: string | null;
  member_id?: string | null; // creator id
  created_by_name?: string | null;
  day?: string | null;
  start_hour?: number | string | null;
  end_hour?: number | string | null;
  label?: string | null;
  sub?: string | null; // location / link
  description?: string | null;
  type?: string | null;
  last_edited_by_name?: string | null;
};

type DeadlineRow = {
  due_date?: string | null;
  title?: string | null;
  label?: string | null;
  name?: string | null;
};

type PersonalRoutineRow = {
  id: string;
  user_id: string;
  label?: string | null;
  details?: string | null;
  color?: string | null;
  days_of_week?: number[] | null;
  start_time?: string | null;
  end_time?: string | null;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MEMBER_FALLBACK_COLORS = ["#4f46e5", "#16a34a", "#ea580c", "#9333ea", "#2563eb", "#ca8a04"] as const;

function startOfWeek(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDateParam(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, yearPart, monthPart, dayPart] = match;
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function toDateParam(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}-${String(normalized.getDate()).padStart(2, "0")}`;
}

function toDayKey(date: Date) {
  return DAY_KEYS[date.getDay()];
}

function parseHour(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    if (value.includes(":")) {
      const [hoursPart = "0", minutesPart = "0"] = value.split(":");
      const hours = Number.parseInt(hoursPart, 10);
      const minutes = Number.parseInt(minutesPart, 10);
      if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        return hours + minutes / 60;
      }
    }

    const numeric = Number.parseFloat(value);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }

  return 0;
}

function toRgba(color: string, alpha: number) {
  const cleaned = color.trim().replace("#", "");
  const normalized = cleaned.length === 3 ? cleaned.split("").map((part) => `${part}${part}`).join("") : cleaned;
  if (normalized.length !== 6) {
    return `rgba(55, 65, 81, ${alpha})`;
  }

  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return `rgba(55, 65, 81, ${alpha})`;
  }

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenHex(color: string) {
  const cleaned = color.trim().replace("#", "");
  const normalized = cleaned.length === 3 ? cleaned.split("").map((part) => `${part}${part}`).join("") : cleaned;
  if (normalized.length !== 6) {
    return "#374151";
  }

  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return "#374151";
  }

  const r = Math.max(0, Math.floor(((value >> 16) & 255) * 0.58));
  const g = Math.max(0, Math.floor(((value >> 8) & 255) * 0.58));
  const b = Math.max(0, Math.floor((value & 255) * 0.58));
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function dayFromDateString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return toDayKey(date);
}

function mapMember(row: MemberRow, index: number): CalendarMember {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles;
  const rawName = (profile?.full_name ?? row.member_id ?? "Member").trim();
  const color = row.color ?? MEMBER_FALLBACK_COLORS[index % MEMBER_FALLBACK_COLORS.length];
  return {
    id: profile?.id ?? row.member_id,
    name: rawName,
    ini: rawName.slice(0, 2).toUpperCase(),
    bg: color,
    lt: toRgba(color, 0.15),
    bd: toRgba(color, 0.5),
    tc: darkenHex(color),
    role: row.role === "pm" ? "pm" : "member",
  };
}

function mapSchedule(row: ScheduleRow): CalendarBlock | null {
  const day = dayFromDateString(row.day);
  const memberId = row.member_id;
  if (!day || !memberId) {
    return null;
  }

  const start = parseHour(row.start_hour);
  const end = parseHour(row.end_hour);
  if (!(end > start)) {
    return null;
  }

  // include creator name and description separately
  return {
    memberId,
    days: [day],
    s: start,
    e: end,
    lbl: row.label ?? "Meeting",
    sub: row.sub ?? "",
    description: row.description ?? "",
    id: row.id ?? undefined,
    creatorId: row.member_id ?? undefined,
    creatorName: row.created_by_name ?? undefined,
    lastEditedByName: row.last_edited_by_name ?? undefined,
    routine: false,
  };
}

function mapDeadline(row: DeadlineRow): CalendarDeadline | null {
  const day = dayFromDateString(row.due_date);
  if (!day) {
    return null;
  }

  return {
    days: [day],
    lbl: row.title ?? row.label ?? row.name ?? "Deadline",
  };
}

export default async function CircleCalendarPage({ params, searchParams }: PageProps) {
  const { groupId } = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("member_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect("/dashboard");
  }

  const { data: group } = await supabase
    .from("groups")
    .select("name, subject, color")
    .eq("id", groupId)
    .maybeSingle();

  const rawWeekOffset = Array.isArray(resolvedSearchParams?.week) ? resolvedSearchParams.week[0] : resolvedSearchParams?.week;
  const rawDate = Array.isArray(resolvedSearchParams?.date) ? resolvedSearchParams.date[0] : resolvedSearchParams?.date;
  const weekOffset = Number.parseInt(rawWeekOffset ?? "0", 10);
  const safeWeekOffset = Number.isNaN(weekOffset) ? 0 : weekOffset;
  const selectedDate = parseDateParam(rawDate) ?? addDays(new Date(), safeWeekOffset * 7);
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 6);
  weekEnd.setHours(23, 59, 59, 999);

  const initialMembersResult = await supabase
    .from("group_members")
    .select(
      `
        member_id,
        role,
        color,
        profiles (
          id,
          full_name
        )
      `,
    )
    .eq("group_id", groupId);

  let membersData = (initialMembersResult.data ?? []) as MemberRow[];
  let membersError = initialMembersResult.error;

  if (membersError?.message?.includes("column group_members.color does not exist")) {
    const fallbackMembersResult = await supabase
      .from("group_members")
      .select(
        `
          member_id,
          role,
          profiles (
            id,
            full_name
          )
        `,
      )
      .eq("group_id", groupId);

    membersData = (fallbackMembersResult.data ?? []) as MemberRow[];
    membersError = fallbackMembersResult.error;
  }

  if (membersError) {
    const bareMembersResult = await supabase
      .from("group_members")
      .select("member_id, role")
      .eq("group_id", groupId);

    membersData = ((bareMembersResult.data ?? []) as Array<{ member_id: string; role: string | null }>).map((row) => ({
      ...row,
      profiles: null,
    }));

    if (bareMembersResult.error) {
      console.error("[group-calendar] failed to load group members", {
        groupId,
        error: bareMembersResult.error.message,
      });
    }
  }

  const memberIds = membersData.map((row) => row.member_id).filter((memberId): memberId is string => Boolean(memberId));

  const [personalRoutinesResult, schedulesResult, deadlinesResult, tasksResult] = await Promise.all([
    memberIds.length > 0
      ? supabase
          .from("personal_routines")
          .select("id, user_id, label, details, color, days_of_week, start_time, end_time")
          .in("user_id", memberIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("schedules")
      .select("*")
      .eq("group_id", groupId)
      .gte("day", weekStart.toISOString())
      .lte("day", weekEnd.toISOString()),
    supabase
      .from("deadlines")
      .select("*")
      .eq("group_id", groupId)
      .gte("due_date", weekStart.toISOString())
      .lte("due_date", weekEnd.toISOString()),
    supabase
      .from("tasks")
      .select("id, title, due_date, status, group_id, sprint_id, starts_at, ends_at")
      .eq("group_id", groupId)
      .gte("due_date", weekStart.toISOString())
      .lte("due_date", weekEnd.toISOString()),
  ]);

  if (personalRoutinesResult.error) {
    console.error("[group-calendar] failed to load personal routines", {
      groupId,
      memberCount: memberIds.length,
      error: personalRoutinesResult.error.message,
    });
  }

  const members = membersData.map((row, index) => mapMember(row, index));
  const personalRoutines = (personalRoutinesResult.data ?? []) as PersonalRoutineRow[];
  const schedules = (schedulesResult.data ?? []) as ScheduleRow[];
  const deadlines = (deadlinesResult.data ?? []) as DeadlineRow[];
  const tasks = (tasksResult.data ?? []) as Array<{ id: string; title: string; due_date: string; status: string; group_id: string; sprint_id: string | null; starts_at: string | null; ends_at: string | null }>;

  const DAY_KEY_BY_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  type DayKey = (typeof DAY_KEY_BY_INDEX)[number];

  const routineBlocks: CalendarBlock[] = personalRoutines.flatMap((routine) => {
    const startParts = (routine.start_time ?? "0:00").split(":").map((part) => Number.parseInt(part, 10));
    const endParts = (routine.end_time ?? "0:00").split(":").map((part) => Number.parseInt(part, 10));
    const startHour = (startParts[0] ?? 0) + (startParts[1] ?? 0) / 60;
    const endHour = (endParts[0] ?? 0) + (endParts[1] ?? 0) / 60;

    if (!(endHour > startHour)) {
      return [];
    }

    const days = (routine.days_of_week ?? [])
      .map((dayOfWeek): DayKey | null => DAY_KEY_BY_INDEX[dayOfWeek] ?? null)
      .filter((dayKey): dayKey is DayKey => dayKey !== null);

    if (days.length === 0) {
      return [];
    }

    return [
      {
        memberId: routine.user_id,
        days,
        s: startHour,
        e: endHour,
        lbl: routine.label ?? "Routine",
        sub: routine.details === "Personal routine" || routine.details === "Personal" ? "" : (routine.details ?? ""),
        routine: true,
      },
    ];
  });

  const scheduleBlocks = schedules.map(mapSchedule).filter((block): block is CalendarBlock => Boolean(block));
  
  // Tasks with specific times become blocks, otherwise they become deadlines
  const taskBlocks = tasks
    .filter(t => t.starts_at && t.ends_at)
    .map(t => {
      const day = dayFromDateString(t.due_date);
      if (!day) return null;
      const startAt = new Date(t.starts_at!);
      const endAt = new Date(t.ends_at!);
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
      return {
        memberId: "task-" + t.id,
        days: [day],
        s: startAt.getHours() + startAt.getMinutes() / 60,
        e: endAt.getHours() + endAt.getMinutes() / 60,
        lbl: t.title,
        sub: `Task · ${t.status}`,
        routine: false,
      } as CalendarBlock;
    })
    .filter((block): block is CalendarBlock => Boolean(block));

  const blocks = mergeBlocks(routineBlocks, [...scheduleBlocks, ...taskBlocks]);
  const freeWindows = computeFreeWindows(members, blocks, weekStart);
  
  const explicitDeadlines = deadlines.map(mapDeadline).filter((deadline): deadline is CalendarDeadline => Boolean(deadline));
  const taskDeadlines = tasks
    .filter(t => !(t.starts_at && t.ends_at))
    .map(t => {
      const base = mapDeadline({ due_date: t.due_date, title: t.title });
      if (!base) return null;
      return { ...base, taskId: t.id, sprintId: t.sprint_id } as CalendarDeadline;
    })
    .filter((deadline): deadline is CalendarDeadline => Boolean(deadline));
  
  const deadlineData = [...explicitDeadlines, ...taskDeadlines];

  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      

      <div className="min-h-0 flex-1">
      <Suspense
        fallback={
          <div className="flex flex-col gap-0 flex-1 min-h-0">
            <div className="grid border-b" style={{ gridTemplateColumns: "60px repeat(7, minmax(0,1fr))" }}>
              <div className="h-[76px] border-r" />
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="border-l px-2 py-2 flex flex-col items-center gap-2">
                  <div className="h-2.5 w-6 rounded bg-zinc-100 animate-pulse" />
                  <div className="h-7 w-7 rounded-full bg-zinc-100 animate-pulse" />
                </div>
              ))}
            </div>
            <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: "60px repeat(7, minmax(0,1fr))" }}>
              <div className="border-r">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-[60px] flex items-start justify-end pr-2 pt-1 border-t">
                    <div className="h-2.5 w-8 rounded bg-zinc-100 animate-pulse" />
                  </div>
                ))}
              </div>
              {Array.from({ length: 7 }).map((_, colI) => (
                <div key={colI} className="border-l relative">
                  {Array.from({ length: 8 }).map((_, rowI) => (
                    <div key={rowI} className="h-[60px] border-t" />
                  ))}
                  {colI % 2 === 0 && (
                    <div
                      className="absolute rounded-md left-[2%] right-[2%] bg-zinc-100 animate-pulse"
                      style={{ top: `${30 + colI * 20}px`, height: `${60 + colI * 15}px` }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        }
      >
      <CalendarShell
        members={members}
        blocks={blocks}
        freeWindows={freeWindows}
        deadlines={deadlineData}
        groupId={groupId}
        groupName={group?.name ?? "Circle"}
        groupColor={group?.color ?? "#4f46e5"}
        groupSubject={group?.subject ?? null}
        weekOffset={safeWeekOffset}
        selectedDate={toDateParam(selectedDate)}
      />
      </Suspense>
      </div>
    </div>
  );
}
