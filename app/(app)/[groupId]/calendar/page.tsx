import { redirect } from "next/navigation";
import Link from "next/link";
import CalendarShell from "@/components/circle-calendar/CalendarShell";
import { createClient } from "@/lib/supabaseServer";
import { computeFreeWindows } from "@/lib/schedule/computeFreeWindows";
import { mergeBlocks } from "@/lib/schedule/mergeBlocks";
import type { CalendarBlock, CalendarDeadline, CalendarMember } from "@/types";

type PageProps = {
  params: { groupId: string } | Promise<{ groupId: string }>;
  searchParams?: { week?: string | string[] } | Promise<{ week?: string | string[] }>;
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

  const { data: group } = await supabase
    .from("groups")
    .select("name, subject")
    .eq("id", groupId)
    .maybeSingle();

  const rawWeekOffset = Array.isArray(resolvedSearchParams?.week) ? resolvedSearchParams.week[0] : resolvedSearchParams?.week;
  const weekOffset = Number.parseInt(rawWeekOffset ?? "0", 10);
  const safeWeekOffset = Number.isNaN(weekOffset) ? 0 : weekOffset;
  const weekStart = addDays(startOfWeek(new Date()), safeWeekOffset * 7);
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

  const [personalRoutinesResult, schedulesResult, deadlinesResult] = await Promise.all([
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
        sub: routine.details ?? "Personal routine",
        routine: true,
      },
    ];
  });

  const scheduleBlocks = schedules.map(mapSchedule).filter((block): block is CalendarBlock => Boolean(block));
  const blocks = mergeBlocks(routineBlocks, scheduleBlocks);
  const freeWindows = computeFreeWindows(members, blocks, weekStart);
  const deadlineData = deadlines.map(mapDeadline).filter((deadline): deadline is CalendarDeadline => Boolean(deadline));

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-1 md:h-[calc(100dvh-6.5rem)]">
      <div className="mx-auto flex w-full justify-start px-2 sm:px-3">
        <Link
          href="/dashboard"
          className="ml-5 mb-1 -mt-2 inline-flex h-6 items-center justify-center rounded-md border border-border bg-background px-2 text-[11px] font-medium whitespace-nowrap text-foreground transition-all hover:bg-muted hover:text-foreground"
        >
          <span className="mr-1" aria-hidden="true">&larr;</span>
          Back
        </Link>
      </div>

      <div className="min-h-0 flex-1">
      <CalendarShell
        members={members}
        blocks={blocks}
        freeWindows={freeWindows}
        deadlines={deadlineData}
        groupId={groupId}
        groupName={group?.name ?? "Circle"}
        groupSubject={group?.subject ?? null}
        weekOffset={safeWeekOffset}
      />
      </div>
    </div>
  );
}
