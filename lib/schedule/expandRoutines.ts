import type { CalendarBlock } from "@/types";

type RoutineRow = {
  id?: string;
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

type RoutineExceptionRow = {
  exception_date?: string | null;
  day?: string | null;
  date?: string | null;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function pad(number: number) {
  return String(number).padStart(2, "0");
}

function toDayKey(date: Date) {
  return DAY_KEYS[date.getDay()];
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

    const [hourPart = "0", minutePart = "0"] = value.split(":");
    const hours = Number.parseInt(hourPart, 10);
    const minutes = Number.parseInt(minutePart, 10);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      return hours + minutes / 60;
    }
  }

  return 0;
}

function dayKeysFromRoutine(row: RoutineRow) {
  if (Array.isArray(row.days) && row.days.length > 0) {
    return row.days
      .map((day) => day.slice(0, 3).toLowerCase())
      .filter((day): day is (typeof DAY_KEYS)[number] => DAY_KEYS.includes(day as (typeof DAY_KEYS)[number]));
  }

  if (Array.isArray(row.days_of_week) && row.days_of_week.length > 0) {
    return row.days_of_week
      .map((day) => DAY_KEYS[((day % 7) + 7) % 7])
      .filter((day): day is (typeof DAY_KEYS)[number] => Boolean(day));
  }

  return [] as (typeof DAY_KEYS)[number][];
}

function exceptionKeys(exceptions: RoutineExceptionRow[]) {
  return new Set(
    exceptions
      .map((row) => row.exception_date ?? row.date ?? row.day ?? "")
      .filter(Boolean)
      .map((value) => value.slice(0, 10)),
  );
}

export function expandRoutines(
  routines: RoutineRow[],
  exceptions: RoutineExceptionRow[],
  weekStart: Date,
  weekEnd: Date,
): CalendarBlock[] {
  const exceptionSet = exceptionKeys(exceptions);
  const blocks: CalendarBlock[] = [];

  for (const routine of routines) {
    const memberId = routine.member_id ?? routine.memberId;
    if (!memberId) {
      continue;
    }

    const routineDays = dayKeysFromRoutine(routine);
    if (!routineDays.length) {
      continue;
    }

    const startHour = parseHour(routine.start_hour ?? routine.start_time);
    const endHour = parseHour(routine.end_hour ?? routine.end_time);
    if (!(endHour > startHour)) {
      continue;
    }

    const label = routine.label ?? "Routine";
    const sub = routine.details ?? routine.sub ?? routine.location ?? "";

    const cursor = new Date(weekStart);
    while (cursor <= weekEnd) {
      const dayKey = toDayKey(cursor);
      const dateKey = toDateKey(cursor);
      if (routineDays.includes(dayKey) && !exceptionSet.has(dateKey)) {
        blocks.push({
          memberId,
          days: [dayKey],
          s: startHour,
          e: endHour,
          lbl: label,
          sub,
          routine: true,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return blocks;
}
