import type { CalendarBlock, CalendarMember, FreeWindow } from "@/types";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WINDOW_START_HOUR = 5;
const WINDOW_END_HOUR = 24;
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};
const DAY_ORDER: Array<(typeof DAY_KEYS)[number]> = ["mon", "tue", "wed", "thu", "fri", "sat"];

function dayKey(date: Date) {
  return DAY_KEYS[date.getDay()];
}

function formatTime(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  const wholeHour = Math.floor(normalized);
  const minutes = Math.round((normalized - wholeHour) * 60);
  const suffix = wholeHour >= 12 ? "PM" : "AM";
  const displayHour = wholeHour > 12 ? wholeHour - 12 : wholeHour === 0 ? 12 : wholeHour;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

function formatDuration(start: number, end: number) {
  const totalMinutes = Math.round((end - start) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }
  if (hours === 0) {
    return `${minutes} min`;
  }
  return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min`;
}

function formatWindowEnd(end: number) {
  return end === WINDOW_END_HOUR ? WINDOW_END_HOUR - 1 / 60 : end;
}

function covers(block: CalendarBlock, day: string, hour: number) {
  return block.days.includes(day) && hour >= block.s && hour < block.e;
}

export function computeFreeWindows(
  members: CalendarMember[],
  blocks: CalendarBlock[],
  weekStart: Date,
): FreeWindow[] {
  const windows: FreeWindow[] = [];
  const visibleMembers = members.map((member) => member.id);

  for (let dayIndex = 1; dayIndex <= 6; dayIndex += 1) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayIndex);
    const day = dayKey(date);
    const dayBlocks = blocks.filter((block) => block.days.includes(day));

    let activeStart: number | null = null;
    let activeMembers: string[] = [];

    for (let hour = WINDOW_START_HOUR; hour < WINDOW_END_HOUR; hour += 0.5) {
      const freeMembers = visibleMembers.filter(
        (memberId) => !dayBlocks.some((block) => covers(block, day, hour)),
      );
      const freeSubset = freeMembers.sort();

      const sameSubset =
        activeStart !== null &&
        activeMembers.length === freeSubset.length &&
        activeMembers.every((value, index) => value === freeSubset[index]);

      if (!sameSubset) {
        if (activeStart !== null && activeMembers.length >= 2) {
          const start = activeStart;
          const end = hour;
          if (end - start >= 1) {
            const displayEnd = formatWindowEnd(end);
            windows.push({
              days: [day],
              s: start,
              e: end,
              memberIds: activeMembers,
              lbl: `${DAY_LABELS[day]} ${formatTime(start)}–${formatTime(displayEnd)}`,
              dur: formatDuration(start, displayEnd),
            });
          }
        }

        activeStart = freeSubset.length >= 2 ? hour : null;
        activeMembers = freeSubset.length >= 2 ? freeSubset : [];
      }
    }

    if (activeStart !== null && activeMembers.length >= 2) {
      const end = WINDOW_END_HOUR;
      if (end - activeStart >= 1) {
        const displayEnd = formatWindowEnd(end);
        windows.push({
          days: [day],
          s: activeStart,
          e: end,
          memberIds: activeMembers,
          lbl: `${DAY_LABELS[day]} ${formatTime(activeStart)}–${formatTime(displayEnd)}`,
          dur: formatDuration(activeStart, displayEnd),
        });
      }
    }
  }

  return windows.sort((a, b) => {
    const aIndex = DAY_ORDER.indexOf(a.days[0] as (typeof DAY_ORDER)[number]);
    const bIndex = DAY_ORDER.indexOf(b.days[0] as (typeof DAY_ORDER)[number]);
    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    return a.s - b.s;
  });
}
