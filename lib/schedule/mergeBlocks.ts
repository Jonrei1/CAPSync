import type { CalendarBlock } from "@/types";

const DAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function dayIndex(day: string) {
  const index = DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number]);
  return index >= 0 ? index : 99;
}

export function mergeBlocks(...groups: CalendarBlock[][]): CalendarBlock[] {
  const merged = groups.flat().filter(Boolean);
  const seen = new Set<string>();

  const deduped = merged.filter((block) => {
    const key = [block.memberId, block.days.join("."), block.s, block.e, block.lbl, block.sub, block.routine ? "r" : "m"].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return deduped.sort((a, b) => {
    const dayDiff = dayIndex(a.days[0] ?? "") - dayIndex(b.days[0] ?? "");
    if (dayDiff !== 0) {
      return dayDiff;
    }
    if (a.s !== b.s) {
      return a.s - b.s;
    }
    if (a.e !== b.e) {
      return a.e - b.e;
    }
    return a.lbl.localeCompare(b.lbl);
  });
}
