import { redirect } from "next/navigation";
import CalendarShell from "@/components/circle-calendar/CalendarShell";
import { designTokens } from "@/components/ui/design-standard";
import { createClient } from "@/lib/supabaseServer";
import { computeFreeWindows } from "@/lib/schedule/computeFreeWindows";
import { expandRoutines } from "@/lib/schedule/expandRoutines";
import { mergeBlocks } from "@/lib/schedule/mergeBlocks";
import type { CalendarBlock, CalendarDeadline, CalendarMember } from "@/types";

type PageProps = {
  params: { groupId: string } | Promise<{ groupId: string }>;
  searchParams?: { week?: string | string[] } | Promise<{ week?: string | string[] }>;
};

type MemberRow = {
  member_id: string;
  role: string | null;
  profiles:
    | {
        id: string;
        name?: string | null;
        avatar_url?: string | null;
        color?: string | null;
      }
    | Array<{
        id: string;
        name?: string | null;
        avatar_url?: string | null;
        color?: string | null;
      }>
    | null;
};

type ScheduleRow = {
  member_id?: string | null;
  created_by?: string | null;
  day?: string | null;
  start_hour?: number | string | null;
  end_hour?: number | string | null;
  label?: string | null;
  sub?: string | null;
  type?: string | null;
};

type DeadlineRow = {
  due_date?: string | null;
  title?: string | null;
  label?: string | null;
  name?: string | null;
};

type CalendarRoutineRow = {
  member_id?: string | null;
  memberId?: string | null;
  label?: string | null;
  details?: string | null;
  sub?: string | null;
  location?: string | null;
  days_of_week?: number[] | null;
  days?: string[] | null;
  start_time?: string | null;
  end_time?: string | null;
  start_hour?: number | string | null;
  end_hour?: number | string | null;
};

type CalendarRoutineExceptionRow = {
  exception_date?: string | null;
  day?: string | null;
  date?: string | null;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

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

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toDayKey(date: Date) {
  return DAY_KEYS[date.getDay()];
}

function parseHour(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number.parseFloat(value);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }

    const [hoursPart = "0", minutesPart = "0"] = value.split(":");
    const hours = Number.parseInt(hoursPart, 10);
    const minutes = Number.parseInt(minutesPart, 10);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return hours + minutes / 60;
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
  const rawName = (profile?.name ?? row.member_id ?? "Member").trim();
  const color = profile?.color ?? designTokens.palette.app.memberSet[index % designTokens.palette.app.memberSet.length];
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
  const memberId = row.member_id ?? row.created_by;
  if (!day || !memberId) {
    return null;
  }

  const start = parseHour(row.start_hour);
  const end = parseHour(row.end_hour);
  if (!(end > start)) {
    return null;
  }

  return {
    memberId,
    days: [day],
    s: start,
    e: end,
    lbl: row.label ?? "Meeting",
    sub: row.sub ?? "",
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

  const rawWeekOffset = Array.isArray(resolvedSearchParams?.week) ? resolvedSearchParams.week[0] : resolvedSearchParams?.week;
  const weekOffset = Number.parseInt(rawWeekOffset ?? "0", 10);
  const safeWeekOffset = Number.isNaN(weekOffset) ? 0 : weekOffset;
  const weekStart = addDays(startOfWeek(new Date()), safeWeekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  weekEnd.setHours(23, 59, 59, 999);

  const [membersResult, routinesResult, exceptionsResult, schedulesResult, deadlinesResult] = await Promise.all([
    supabase
      .from("group_members")
      .select(
        `
        member_id,
        role,
        profiles (
          id, name, avatar_url, color
        )
      `,
      )
      .eq("group_id", groupId),
    supabase.from("routines").select("*").eq("group_id", groupId).eq("is_active", true),
    supabase
      .from("routine_exceptions")
      .select("*")
      .eq("group_id", groupId)
      .gte("exception_date", weekStart.toISOString())
      .lte("exception_date", weekEnd.toISOString()),
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
  ]);

  const members = ((membersResult.data ?? []) as unknown[]).map((row, index) => mapMember(row as MemberRow, index));
  const routines = (routinesResult.data ?? []) as CalendarRoutineRow[];
  const exceptions = (exceptionsResult.data ?? []) as CalendarRoutineExceptionRow[];
  const schedules = (schedulesResult.data ?? []) as ScheduleRow[];
  const deadlines = (deadlinesResult.data ?? []) as DeadlineRow[];

  const routineBlocks = expandRoutines(routines, exceptions, weekStart, weekEnd);
  const scheduleBlocks = schedules.map(mapSchedule).filter((block): block is CalendarBlock => Boolean(block));
  const blocks = mergeBlocks(routineBlocks, scheduleBlocks);
  const freeWindows = computeFreeWindows(members, blocks, weekStart);
  const deadlineData = deadlines.map(mapDeadline).filter((deadline): deadline is CalendarDeadline => Boolean(deadline));

  return (
    <CalendarShell
      members={members}
      blocks={blocks}
      freeWindows={freeWindows}
      deadlines={deadlineData}
      groupId={groupId}
      weekOffset={safeWeekOffset}
    />
  );
}
