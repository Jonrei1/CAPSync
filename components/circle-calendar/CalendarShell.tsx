"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import FloatingTooltip, { type FloatingTooltipContent } from "@/components/calendar/FloatingTooltip";
import AddMeetingDialog from "@/components/circle-calendar/AddMeetingDialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDesignStandard } from "@/components/ui/design-standard";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import supabase from "@/lib/supabaseClient";
import type { CalendarBlock, CalendarDeadline, CalendarMember, FreeWindow } from "@/types";

type CalendarShellProps = {
  members: CalendarMember[];
  blocks: CalendarBlock[];
  freeWindows: FreeWindow[];
  deadlines: CalendarDeadline[];
  groupId: string;
  weekOffset: number;
};

type Layout = "week" | "heat" | "dots" | "free";

type TipRow = {
  dot?: string;
  txt: string;
};

type MeetingPrefill = {
  day?: string;
  start?: number;
  end?: number;
};

type DayBlock = CalendarBlock & {
  member: CalendarMember;
};

type LayoutEvent = DayBlock & {
  top: number;
  height: number;
  left: number;
  width: number;
  startHour: number;
  endHour: number;
  compact: boolean;
};

const SLOT = 52;
const START_HOUR = 6;
const END_HOUR = 23;
const HEAT_START_HOUR = 7;
const HEAT_END_HOUR = 20;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const ROUTINE_COLORS = ["#4f46e5", "#16a34a", "#ea580c", "#9333ea", "#2563eb", "#ca8a04"];
const HEAT_COLORS = ["#f0fdf4", "#dbeafe", "#93c5fd", "#3b82f6", "#1e3a8a"];
const HEAT_BORDERS = ["#86efac", "#bfdbfe", "#60a5fa", "#1d4ed8", "#172554"];
const HEAT_TEXT = ["#15803d", "#1e40af", "#1e40af", "#ffffff", "#ffffff"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatTime(hour: number) {
  const whole = Math.floor(hour);
  const period = whole >= 12 ? "P" : "A";
  const display = whole > 12 ? whole - 12 : whole === 0 ? 12 : whole;
  return `${display}${period}`;
}

function formatTooltipTime(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  const whole = Math.floor(normalized);
  const minutes = Math.round((normalized % 1) * 60);
  const period = whole >= 12 ? "PM" : "AM";
  const display = whole > 12 ? whole - 12 : whole === 0 ? 12 : whole;
  return `${display}:${pad(minutes)} ${period}`;
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

function getWeekDates(offset = 0) {
  const current = new Date();
  current.setDate(current.getDate() + offset * 7);
  const dayOfWeek = current.getDay();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(current);
    date.setDate(current.getDate() - dayOfWeek + index);
    date.setHours(12, 0, 0, 0);
    return date;
  });
}

function formatRange(start: Date, end: Date) {
  const options = { month: "short", day: "numeric" } as const;
  return `${start.toLocaleDateString("en-PH", options)} - ${end.toLocaleDateString("en-PH", options)}`;
}

function toRgba(color: string, alpha: number) {
  const cleaned = color.trim();
  const hex = cleaned.startsWith("#") ? cleaned.slice(1) : cleaned;
  const normalized =
    hex.length === 3
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex;

  if (normalized.length !== 6) {
    return `rgba(55, 65, 81, ${alpha})`;
  }

  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return `rgba(55, 65, 81, ${alpha})`;
  }

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getDayKey(date: Date) {
  return DAY_KEYS[date.getDay()];
}

function getTooltipPoint(clientX: number, clientY: number) {
  return {
    x: Math.min(clientX + 14, window.innerWidth - 240),
    y: Math.max(clientY - 8, 8),
  };
}

function getWeekOffsetForDate(date: Date) {
  const currentWeekStart = startOfWeek(new Date());
  const targetWeekStart = startOfWeek(date);
  return Math.round((targetWeekStart.getTime() - currentWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function layoutEvents(events: LayoutEvent[]) {
  if (!events.length) {
    return [] as LayoutEvent[];
  }

  const sorted = [...events].sort((left, right) =>
    left.startHour !== right.startHour ? left.startHour - right.startHour : right.endHour - left.endHour,
  );

  const slotEnds: number[] = [];

  sorted.forEach((event) => {
    let slot = -1;
    for (let index = 0; index < slotEnds.length; index += 1) {
      if (slotEnds[index] <= event.startHour + 0.01) {
        slot = index;
        break;
      }
    }

    if (slot === -1) {
      slot = slotEnds.length;
      slotEnds.push(event.endHour);
    } else {
      slotEnds[slot] = event.endHour;
    }

    event.left = slot;
  });

  sorted.forEach((event) => {
    let maxSlot = event.left;
    sorted.forEach((other) => {
      const overlap = other.startHour < event.endHour && other.endHour > event.startHour;
      if (overlap) {
        maxSlot = Math.max(maxSlot, other.left);
      }
    });

    const cols = maxSlot + 1;
    event.width = 100 / cols;
    event.left = (event.left * 100) / cols;
  });

  return sorted;
}

export default function CalendarShell({ members, blocks, freeWindows, deadlines, groupId, weekOffset }: CalendarShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ds = useDesignStandard();
  const [layout, setLayout] = useState<Layout>("week");
  const [visibleMemberIds, setVisibleMemberIds] = useState<string[]>(() => members.map((member) => member.id));
  const [addMeetingOpen, setAddMeetingOpen] = useState(false);
  const [meetingPrefill, setMeetingPrefill] = useState<MeetingPrefill>({});
  const [showRoutineDialog, setShowRoutineDialog] = useState(false);
  const [newRoutineLabel, setNewRoutineLabel] = useState("");
  const [newRoutineStart, setNewRoutineStart] = useState("09:00");
  const [newRoutineEnd, setNewRoutineEnd] = useState("10:00");
  const [newRoutineDays, setNewRoutineDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newRoutineColor, setNewRoutineColor] = useState(ROUTINE_COLORS[0]);
  const [nowTick, setNowTick] = useState(() => new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [hoverTooltip, setHoverTooltip] = useState<FloatingTooltipContent | null>(null);
  const tooltipElementRef = useRef<HTMLDivElement | null>(null);
  const tooltipRafRef = useRef<number | null>(null);
  const tooltipPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const tooltipVisibleRef = useRef(false);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = weekDates[0];
  const weekLabel = useMemo(() => formatRange(weekDates[0], weekDates[6]), [weekDates]);
  const visibleMemberSet = useMemo(() => new Set(visibleMemberIds), [visibleMemberIds]);

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.id, member] as const)),
    [members],
  );

  const visibleMembers = useMemo(
    () => members.filter((member) => visibleMemberSet.has(member.id)),
    [members, visibleMemberSet],
  );

  const visibleCount = visibleMembers.length;

  const memberBlockCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const block of blocks) {
      counts.set(block.memberId, (counts.get(block.memberId) ?? 0) + 1);
    }
    return counts;
  }, [blocks]);

  const visibleBlocks = useMemo(
    () => blocks.filter((block) => visibleMemberSet.has(block.memberId)),
    [blocks, visibleMemberSet],
  );

  const blocksByDay = useMemo(() => {
    const map = new Map<string, DayBlock[]>();

    for (const block of visibleBlocks) {
      const member = memberMap.get(block.memberId);
      if (!member) {
        continue;
      }

      for (const day of block.days) {
        const dayBlocks = map.get(day) ?? [];
        dayBlocks.push({ ...block, member });
        map.set(day, dayBlocks);
      }
    }

    return map;
  }, [memberMap, visibleBlocks]);

  const minFreeMembers = Math.max(2, visibleCount - 1);
  const visibleFreeWindows = useMemo(
    () =>
      freeWindows.filter(
        (window) => window.memberIds.filter((memberId) => visibleMemberSet.has(memberId)).length >= minFreeMembers,
      ),
    [freeWindows, minFreeMembers, visibleMemberSet],
  );

  const visibleFreeWindowCount = visibleFreeWindows.length;
  const sharedFreeWindowCount = useMemo(
    () =>
      visibleFreeWindows.filter(
        (window) => window.memberIds.filter((memberId) => visibleMemberSet.has(memberId)).length >= visibleCount,
      ).length,
    [visibleCount, visibleFreeWindows, visibleMemberSet],
  );

  useEffect(() => {
    setVisibleMemberIds((current) => {
      const next = members.map((member) => member.id).filter((memberId) => current.includes(memberId));
      return next.length > 0 ? next : members.map((member) => member.id);
    });
  }, [members]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTick(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (tooltipRafRef.current) {
        cancelAnimationFrame(tooltipRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`circle-calendar:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "routines",
          filter: `group_id=eq.${groupId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedules",
          filter: `group_id=eq.${groupId}`,
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "routine_exceptions",
          filter: `group_id=eq.${groupId}`,
        },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, router]);

  function navigateToWeek(nextOffset: number) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextOffset === 0) {
      nextParams.delete("week");
    } else {
      nextParams.set("week", String(nextOffset));
    }

    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function showTip(event: { clientX: number; clientY: number }, title: string, rows: TipRow[]) {
    const tip = tooltipElementRef.current;
    if (!tip) {
      return;
    }

    setHoverTooltip({
      title,
      rows: rows.map((row) => ({ text: row.txt, dot: row.dot })),
    });
    tooltipPointRef.current = getTooltipPoint(event.clientX, event.clientY);
    tooltipVisibleRef.current = true;

    window.requestAnimationFrame(() => {
      tip.style.transform = `translate3d(${tooltipPointRef.current.x}px, ${tooltipPointRef.current.y}px, 0)`;
    });
  }

  function trackTip(event: { clientX: number; clientY: number }) {
    if (!tooltipVisibleRef.current) {
      return;
    }

    tooltipPointRef.current = getTooltipPoint(event.clientX, event.clientY);
    if (tooltipRafRef.current) {
      return;
    }

    tooltipRafRef.current = window.requestAnimationFrame(() => {
      tooltipRafRef.current = null;
      const tip = tooltipElementRef.current;
      if (tip) {
        tip.style.transform = `translate3d(${tooltipPointRef.current.x}px, ${tooltipPointRef.current.y}px, 0)`;
      }
    });
  }

  function hideTip() {
    tooltipVisibleRef.current = false;
    if (tooltipRafRef.current) {
      cancelAnimationFrame(tooltipRafRef.current);
      tooltipRafRef.current = null;
    }
    setHoverTooltip(null);
  }

  function openAddMeeting(day: string, start: number, end: number) {
    setMeetingPrefill({ day, start, end });
    setAddMeetingOpen(true);
  }

  function toggleMember(memberId: string) {
    setVisibleMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  }

  function setAllVisible(nextVisible: boolean) {
    if (nextVisible) {
      setVisibleMemberIds(members.map((member) => member.id));
      return;
    }
    setVisibleMemberIds([]);
  }

  function doSuggest() {
    toast({ title: "AI meeting suggester coming soon" });
  }

  async function saveRoutine() {
    if (!newRoutineLabel.trim()) {
      toast({ title: "Please enter a routine name" });
      return;
    }

    if (newRoutineDays.length === 0) {
      toast({ title: "Please select at least one day" });
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      return;
    }

    const [startHours, startMinutes] = newRoutineStart.split(":").map((part) => Number.parseInt(part, 10));
    const [endHours, endMinutes] = newRoutineEnd.split(":").map((part) => Number.parseInt(part, 10));
    const startHour = (startHours ?? 0) + (startMinutes ?? 0) / 60;
    const endHour = (endHours ?? 0) + (endMinutes ?? 0) / 60;

    if (endHour <= startHour) {
      toast({ title: "End time must be later than start time" });
      return;
    }

    const { error } = await supabase.from("personal_routines").insert({
      user_id: userId,
      label: newRoutineLabel.trim(),
      details: "Personal",
      color: newRoutineColor,
      days_of_week: newRoutineDays,
      start_time: newRoutineStart,
      end_time: newRoutineEnd,
      is_active: true,
    });

    if (error) {
      toast({ title: "Failed to save routine" });
      return;
    }

    setShowRoutineDialog(false);
    setNewRoutineLabel("");
    setNewRoutineStart("09:00");
    setNewRoutineEnd("10:00");
    setNewRoutineDays([1, 2, 3, 4, 5]);
    setNewRoutineColor(ROUTINE_COLORS[0]);
    router.refresh();
  }

  function handleRoutineStartChange(nextValue: string) {
    setNewRoutineStart(nextValue);
    const [hoursPart, minutesPart] = nextValue.split(":");
    const nextStartMinutes = Number.parseInt(hoursPart ?? "0", 10) * 60 + Number.parseInt(minutesPart ?? "0", 10);
    const [endHoursPart, endMinutesPart] = newRoutineEnd.split(":");
    const currentEndMinutes = Number.parseInt(endHoursPart ?? "0", 10) * 60 + Number.parseInt(endMinutesPart ?? "0", 10);

    if (currentEndMinutes <= nextStartMinutes) {
      const nextEndMinutes = Math.min(nextStartMinutes + 60, END_HOUR * 60);
      const hours = Math.floor(nextEndMinutes / 60);
      const minutes = nextEndMinutes % 60;
      setNewRoutineEnd(`${pad(hours)}:${pad(minutes)}`);
    }
  }

  const weekView = useMemo(() => {
    const today = new Date();
    const nowHour = nowTick.getHours() + nowTick.getMinutes() / 60;
    const nowVisible = nowHour >= START_HOUR && nowHour <= END_HOUR;
    const nowTop = Math.max(0, Math.min((nowHour - START_HOUR) * SLOT, (END_HOUR - START_HOUR) * SLOT));

    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="icon-sm" onClick={() => navigateToWeek(weekOffset - 1)}>
                &#8249;
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => navigateToWeek(0)}>
                Today
              </Button>
              <Button type="button" variant="outline" size="icon-sm" onClick={() => navigateToWeek(weekOffset + 1)}>
                &#8250;
              </Button>
              <span className="text-sm font-semibold tracking-tight text-foreground">{weekLabel}</span>
              <div className="inline-flex items-center gap-1.5 border-l border-border/70 pl-2">
                <span className="text-[11px] text-muted-foreground">Go to date</span>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        data-empty={!weekStart}
                        className="w-52 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                      >
                        {weekStart ? format(weekStart, "PPP") : <span>Pick a date</span>}
                        <ChevronDownIcon data-icon="inline-end" />
                      </Button>
                    }
                  />
                  <PopoverContent className={cn(ds.calendar.dateJumpPopover)} align="start">
                    <Calendar
                      mode="single"
                      selected={weekStart}
                      defaultMonth={weekStart}
                      onSelect={(nextDate) => {
                        if (!nextDate) {
                          return;
                        }
                        navigateToWeek(getWeekOffsetForDate(nextDate));
                        setDatePickerOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowRoutineDialog(true)}>
                Add routine
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={doSuggest}>
                Suggest meeting
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/30 px-4 py-3 sm:px-5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Members</span>
            <div className="flex flex-1 flex-wrap gap-2">
              {members.map((member) => {
                const visible = visibleMemberSet.has(member.id);
                const blockCount = memberBlockCounts.get(member.id) ?? 0;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-150",
                      visible
                        ? "bg-background shadow-sm hover:-translate-y-0.5"
                        : "border-border/70 bg-muted/60 opacity-50",
                    )}
                    style={{ borderColor: visible ? member.bd : undefined }}
                  >
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: member.bg, opacity: visible ? 1 : 0.45 }}
                    >
                      {member.ini}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-foreground">{member.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {member.role} - {blockCount} blocks this week
                      </div>
                    </div>
                    <div
                      className={cn(
                        "ml-1 flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold transition-colors",
                        visible ? "border-emerald-500 bg-emerald-500 text-white" : "border-border/70 bg-transparent text-muted-foreground",
                      )}
                    >
                      {visible ? "✓" : ""}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>
                {visibleCount} of {members.length} visible
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAllVisible(true)}>
                Show all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAllVisible(false)}>
                Hide all
              </Button>
            </div>
          </div>

          <div className="border-b border-border/70 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "week", label: "Calendar", hint: "Week grid", icon: "📅" },
                  { key: "heat", label: "Heat map", hint: "Density", icon: "▦" },
                  { key: "dots", label: "Availability", hint: "Dot grid", icon: "⠿" },
                  { key: "free", label: "Free windows", hint: "Clutter-free", icon: "◈" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setLayout(item.key as Layout)}
                    className={cn(
                      "flex min-w-22 flex-col items-center gap-1 rounded-xl border px-4 py-3 text-center text-[11px] transition-all duration-150",
                      layout === item.key
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border/70 bg-background text-muted-foreground hover:-translate-y-0.5 hover:border-border hover:text-foreground",
                    )}
                  >
                    <span className="text-sm leading-none">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                    <span className={cn("text-[9px]", layout === item.key ? "text-primary-foreground/70" : "text-muted-foreground")}>{item.hint}</span>
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {visibleFreeWindowCount} shared free windows this week
              </div>
            </div>
          </div>

          {layout === "week" ? (
            <div>
              <div className="overflow-x-auto">
                <div className="min-w-240">
                  <div className="sticky top-0 z-10 grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-border/70 bg-background">
                    <div className="h-12 border-r border-border/70" />
                    {weekDates.map((date, index) => {
                      const dayKey = getDayKey(date);
                      const isToday = date.toDateString() === today.toDateString();

                      return (
                        <div key={dayKey} className="border-l border-border/70 px-2 py-1.5 text-center">
                          <div className={cn("text-[10px] uppercase tracking-[0.05em]", isToday ? "text-primary" : "text-muted-foreground")}>
                            {DAY_LABELS[index]}
                          </div>
                          <div className={cn("mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[16px] font-bold", isToday ? "bg-primary text-primary-foreground" : "text-foreground") }>
                            {date.getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
                    <div className="border-r border-border/70 bg-background">
                      {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => {
                        const hour = START_HOUR + index;
                        return (
                          <div key={hour} className="relative h-13 border-b border-border/70 px-2 text-right text-[10px] text-muted-foreground">
                            <span className="absolute right-2 -top-1.75">{formatTime(hour)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {weekDates.map((date) => {
                      const dayKey = getDayKey(date);
                      const isToday = date.toDateString() === today.toDateString();
                      const dayBlocks = blocksByDay.get(dayKey) ?? [];
                      const laidEvents = layoutEvents(
                        dayBlocks.map((block) => {
                          const startHour = block.s;
                          const endHour = block.e;
                          return {
                            ...block,
                            top: (startHour - START_HOUR) * SLOT,
                            height: Math.max((endHour - startHour) * SLOT, 36),
                            left: 0,
                            width: 100,
                            startHour,
                            endHour,
                            compact: endHour - startHour <= 0.85,
                          };
                        }),
                      );

                      const dayFreeWindows = visibleFreeWindows.filter((window) => window.days.includes(dayKey));
                      const dayDeadlines = deadlines.filter((deadline) => deadline.days.includes(dayKey));

                      return (
                        <div
                          key={dayKey}
                          className={cn("relative border-l border-border/70 bg-background", isToday && "bg-primary/5")}
                          style={{ height: (END_HOUR - START_HOUR) * SLOT }}
                        >
                          {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                            <div key={index} className="absolute left-0 right-0 border-t border-border/70" style={{ top: index * SLOT }} />
                          ))}
                          <div className="absolute left-0 right-0 border-t border-border/70" style={{ top: (END_HOUR - START_HOUR) * SLOT }} />

                          {isToday && nowVisible ? (
                            <div className="pointer-events-none absolute left-0 right-0 z-20 flex items-center" style={{ top: nowTop }}>
                              <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" />
                              <span className="h-px flex-1 bg-red-600" />
                            </div>
                          ) : null}

                          {dayFreeWindows.map((window) => {
                            const visibleMembersInWindow = window.memberIds.filter((memberId) => visibleMemberSet.has(memberId));
                            const isAllVisible = visibleMembersInWindow.length >= visibleCount;

                            return (
                              <button
                                key={`${dayKey}-${window.s}-${window.e}`}
                                type="button"
                                className="absolute inset-x-1.5 z-0 flex cursor-pointer flex-col justify-center gap-1 overflow-hidden rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-100"
                                style={{ top: (window.s - START_HOUR) * SLOT, height: Math.max((window.e - window.s) * SLOT, 24) }}
                                onClick={() => openAddMeeting(window.days[0] ?? dayKey, window.s, window.e)}
                                onMouseEnter={(event) =>
                                  showTip(event, "Free window", [
                                    { dot: "#16a34a", txt: `${formatTooltipTime(window.s)} - ${formatTooltipTime(window.e)}` },
                                    { txt: window.dur },
                                    ...visibleMembersInWindow
                                      .map((memberId) => memberMap.get(memberId))
                                      .filter((member): member is CalendarMember => Boolean(member))
                                      .map((member) => ({ dot: member.bg, txt: `${member.name} is free` })),
                                  ])
                                }
                                onMouseMove={trackTip}
                                onMouseLeave={hideTip}
                              >
                                <div className="flex gap-1">
                                  {visibleMembersInWindow.map((memberId) => {
                                    const member = memberMap.get(memberId);
                                    return member ? (
                                      <span key={memberId} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: member.bg }} />
                                    ) : null;
                                  })}
                                </div>
                                <div className="text-[10px] font-semibold text-emerald-700">
                                  {isAllVisible ? "All free" : "Available"}
                                </div>
                                <div className="text-[9px] text-emerald-600">{formatTooltipTime(window.s)} - {formatTooltipTime(window.e)}</div>
                              </button>
                            );
                          })}

                          {laidEvents.map((event) => {
                            const blockColor = event.member.bg;
                            const blockText = event.routine ? event.member.tc : "#ffffff";
                            const blockMuted = event.routine ? `${event.member.tc}99` : "rgba(255,255,255,.75)";
                            const tagBg = event.routine ? `${event.member.bg}20` : "rgba(255,255,255,.18)";
                            const tagFg = event.routine ? event.member.bg : "#ffffff";

                            return (
                              <div
                                key={`${event.memberId}-${event.days.join("-")}-${event.s}-${event.e}-${event.lbl}`}
                                className="absolute z-10 overflow-hidden rounded-md border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                                style={{
                                  top: event.top,
                                  height: event.height,
                                  left: `calc(${event.left}% + 2px)`,
                                  width: `calc(${Math.max(event.width - 2, 20)}% - 4px)`,
                                  backgroundColor: event.routine ? toRgba(blockColor, 0.16) : blockColor,
                                  borderColor: event.routine ? toRgba(blockColor, 0.38) : blockColor,
                                }}
                                onMouseEnter={(mouseEvent) =>
                                  showTip(mouseEvent, event.lbl, [
                                    { dot: event.member.bg, txt: `${event.member.name} - ${event.member.role}` },
                                    { txt: `${formatTooltipTime(event.s)} - ${formatTooltipTime(event.e)}` },
                                    event.sub ? { txt: event.sub } : null,
                                    { txt: event.routine ? "Recurring routine" : "Manual block" },
                                  ].filter(Boolean) as TipRow[])
                                }
                                onMouseMove={trackTip}
                                onMouseLeave={hideTip}
                              >
                                <div className="flex h-full flex-col gap-0.5 border-l-4 px-2 py-1" style={{ borderLeftColor: event.member.bg }}>
                                  <div className="truncate text-[10px] font-semibold leading-tight" style={{ color: blockText }}>
                                    {event.lbl}
                                  </div>
                                  {!event.compact && event.sub ? (
                                    <div className="truncate text-[9px] leading-tight" style={{ color: blockMuted }}>
                                      {event.sub}
                                    </div>
                                  ) : null}
                                  {!event.compact ? (
                                    <div className="mt-auto inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[8px] font-semibold" style={{ backgroundColor: tagBg, color: tagFg }}>
                                      {event.member.name}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}

                          {dayDeadlines.map((deadline, index) => (
                            <button
                              key={`${dayKey}-${deadline.lbl}-${index}`}
                              type="button"
                              className="absolute right-2 top-2 z-30 rounded-full bg-red-600 px-2 py-1 text-[8px] font-semibold text-white shadow-sm"
                              onMouseEnter={(event) => showTip(event, "Deadline", [{ dot: "#dc2626", txt: deadline.lbl }])}
                              onMouseMove={trackTip}
                              onMouseLeave={hideTip}
                            >
                              {deadline.lbl}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-border/70 bg-muted/30 px-4 py-3 text-[10px] text-muted-foreground sm:px-5">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-[repeating-linear-gradient(45deg,#c7d2fe,#c7d2fe_2px,#818cf8_2px,#818cf8_4px)]" />
                  Routine
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm bg-primary" />
                  Manual
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-50" />
                  Free
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-600" />
                  Deadline
                </div>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  Hover a block for details. Click a free window to book it.
                </span>
              </div>
            </div>
          ) : null}

          {layout === "heat" ? (
            <div className="space-y-4 p-4 sm:p-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Color shows how many visible members are busy each hour. Green means everyone is free.
              </p>
              <div className="overflow-x-auto">
                <div className="grid min-w-180 gap-0.5" style={{ gridTemplateColumns: "42px repeat(7,minmax(0,1fr))" }}>
                  <div />
                  {weekDates.map((date) => (
                    <div key={getDayKey(date)} className="pb-2 text-center text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                      {DAY_LABELS[date.getDay()]}
                    </div>
                  ))}

                  {Array.from({ length: HEAT_END_HOUR - HEAT_START_HOUR + 1 }, (_, index) => HEAT_START_HOUR + index).map((hour) => (
                    <div key={`row-${hour}`} className="contents">
                      <div className="flex h-5.5 items-center justify-end pr-2 text-[9px] text-muted-foreground">
                        {formatTime(hour)}
                      </div>
                      {weekDates.map((date) => {
                        const dayKey = getDayKey(date);
                        const busyMembers = visibleMembers.filter((member) =>
                          blocks.some((block) => block.memberId === member.id && block.days.includes(dayKey) && hour >= block.s && hour < block.e),
                        );
                        const count = busyMembers.length;
                        const bucket = Math.min(count, 4);

                        return (
                          <button
                            key={`${dayKey}-${hour}`}
                            type="button"
                            className="flex h-5.5 items-center justify-center rounded-[3px] border transition-transform duration-150 hover:scale-105"
                            style={{ backgroundColor: HEAT_COLORS[bucket], borderColor: HEAT_BORDERS[bucket] }}
                            onMouseEnter={(event) =>
                              showTip(
                                event,
                                `${DAY_LABELS[date.getDay()]} at ${formatTime(hour)}`,
                                count === 0
                                  ? [{ dot: "#16a34a", txt: "Everyone is free" }]
                                  : busyMembers.map((member) => ({ dot: member.bg, txt: `${member.name} is busy` })),
                              )
                            }
                            onMouseMove={trackTip}
                            onMouseLeave={hideTip}
                            onClick={() => {
                              if (count === 0) {
                                openAddMeeting(dayKey, hour, hour + 1);
                              }
                            }}
                          >
                            {count === 0 ? (
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            ) : (
                              <span className="text-[8px] font-semibold" style={{ color: HEAT_TEXT[bucket] }}>
                                {count >= visibleCount && visibleCount > 0 ? "X" : count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-4 rounded-sm border border-emerald-300 bg-emerald-50" />
                  0 - all free
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-4 rounded-sm bg-[#dbeafe]" />
                  1 busy
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-4 rounded-sm bg-[#93c5fd]" />
                  2 busy
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-4 rounded-sm bg-[#3b82f6]" />
                  3 busy
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-4 rounded-sm bg-[#1e3a8a]" />
                  All busy
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-semibold text-foreground">Best shared windows</div>
                <div className="flex flex-wrap gap-2">
                  {visibleFreeWindows.map((window) => (
                    <button
                      key={`${window.days.join("-")}-${window.s}-${window.e}`}
                      type="button"
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500 hover:text-white"
                      onClick={() => openAddMeeting(window.days[0] ?? "sun", window.s, window.e)}
                    >
                      {window.lbl} - {window.dur}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {layout === "dots" ? (
            <div className="space-y-4 p-4 sm:p-5">
              <div className="overflow-x-auto">
                <div className="min-w-205 space-y-5">
                  <div className="flex pl-24 pb-1 text-[8px] uppercase tracking-[0.08em] text-muted-foreground">
                    {Array.from({ length: 13 }, (_, index) => index + 7).map((hour) => (
                      <div key={hour} className="flex-1 text-center">
                        {hour === 12 ? "12P" : hour > 12 ? `${hour - 12}P` : `${hour}A`}
                      </div>
                    ))}
                  </div>

                  {weekDates.map((date) => {
                    const dayKey = getDayKey(date);
                    const dayWindows = visibleFreeWindows.filter((window) => window.days.includes(dayKey));

                    return (
                      <section key={dayKey} className="space-y-2">
                        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          <span>{DAY_LABELS[date.getDay()]}</span>
                          <div className="h-px flex-1 bg-border/70" />
                        </div>

                        {visibleMembers.map((member) => (
                          <div key={`${dayKey}-${member.id}`} className="flex items-center gap-3">
                            <div className="flex w-24 shrink-0 items-center gap-2">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold text-white" style={{ backgroundColor: member.bg }}>
                                {member.ini}
                              </div>
                              <span className="truncate text-[10px] font-medium text-foreground">{member.name}</span>
                            </div>

                            <div className="flex flex-1 gap-1">
                              {Array.from({ length: 13 }, (_, index) => index + 7).map((hour) => {
                                const busy = blocks.some(
                                  (block) => block.memberId === member.id && block.days.includes(dayKey) && hour >= block.s && hour < block.e,
                                );

                                return (
                                  <button
                                    key={`${member.id}-${dayKey}-${hour}`}
                                    type="button"
                                    className={cn(
                                      "flex h-5 flex-1 items-center justify-center rounded-[3px] border transition-transform duration-150 hover:scale-y-110",
                                      busy ? "border-transparent" : "border-emerald-300 bg-emerald-50",
                                    )}
                                    style={busy ? { backgroundColor: `${member.bg}CC` } : undefined}
                                    onMouseEnter={(event) =>
                                      showTip(event, `${member.name} at ${formatTime(hour)}`, [
                                        { dot: member.bg, txt: member.name },
                                        { txt: `${formatTime(hour)} - ${formatTime(hour + 1)}` },
                                        { txt: busy ? "Busy" : "Free" },
                                      ])
                                    }
                                    onMouseMove={trackTip}
                                    onMouseLeave={hideTip}
                                  >
                                    {busy ? null : <span className="h-1 w-1 rounded-full bg-emerald-500" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {dayWindows.length ? (
                          <div className="flex flex-wrap gap-2 pl-24">
                            {dayWindows.map((window) => (
                              <button
                                key={`${dayKey}-${window.s}-${window.e}`}
                                type="button"
                                className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[9px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500 hover:text-white"
                                onClick={() => openAddMeeting(window.days[0] ?? dayKey, window.s, window.e)}
                              >
                                {window.lbl} - {window.dur}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {layout === "free" ? (
            <div className="space-y-4 p-4 sm:p-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Busy blocks are hidden. Only shared free windows are shown here.
              </p>

              <div className="space-y-3">
                {weekDates.map((date) => {
                  const dayKey = getDayKey(date);
                  const dayWindows = visibleFreeWindows.filter((window) => window.days.includes(dayKey));

                  return (
                    <div key={dayKey} className="overflow-hidden rounded-xl border border-border/70 bg-background">
                      <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-semibold", date.toDateString() === new Date().toDateString() ? "text-primary" : "text-foreground")}>{DAY_LABELS[date.getDay()]}</span>
                          <span className="text-[11px] text-muted-foreground">{date.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</span>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
                          {dayWindows.length} window{dayWindows.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      {dayWindows.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-muted-foreground">No shared free windows on this day.</div>
                      ) : (
                        <div className="divide-y divide-border/70">
                          {dayWindows.map((window) => {
                            const freeMemberIds = window.memberIds.filter((memberId) => visibleMemberSet.has(memberId));
                            const freeMembers = freeMemberIds
                              .map((memberId) => memberMap.get(memberId))
                              .filter((member): member is CalendarMember => Boolean(member));
                            const unavailableMembers = visibleMembers.filter((member) => !freeMemberIds.includes(member.id));
                            const isAllFree = freeMemberIds.length >= visibleCount;

                            return (
                              <div key={`${dayKey}-${window.s}-${window.e}`} className="flex flex-wrap items-center gap-4 px-4 py-4">
                                <div className="min-w-27 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
                                  <div className="text-lg font-bold text-emerald-700">{formatTooltipTime(window.s)}</div>
                                  <div className="text-[10px] text-emerald-600">to {formatTooltipTime(window.e)}</div>
                                  <div className="mt-1 text-[10px] font-medium text-emerald-700">{window.dur}</div>
                                </div>

                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex flex-wrap gap-2">
                                    {freeMembers.map((member) => (
                                      <span key={member.id} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-1 text-[11px] text-foreground">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: member.bg }} />
                                        {member.name}
                                      </span>
                                    ))}
                                  </div>
                                  {unavailableMembers.length ? (
                                    <div className="text-[10px] text-muted-foreground">
                                      {unavailableMembers.map((member) => member.name).join(", ")} unavailable
                                    </div>
                                  ) : (
                                    <div className="text-[10px] font-medium text-emerald-700">All visible members available</div>
                                  )}
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                  <Button type="button" variant="secondary" size="sm" onClick={() => openAddMeeting(window.days[0] ?? dayKey, window.s, window.e)}>
                                    Book
                                  </Button>
                                  <span className="text-[9px] text-muted-foreground">
                                    {isAllFree ? "Everyone free" : `${freeMemberIds.length}/${visibleCount} free`}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-muted/30 px-4 py-3 text-[10px] text-muted-foreground sm:px-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[repeating-linear-gradient(45deg,#c7d2fe,#c7d2fe_2px,#818cf8_2px,#818cf8_4px)]" />
                Routine
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-primary" />
                Manual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-50" />
                Free
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-600" />
                Deadline
              </span>
            </div>
            <span>
              {visibleCount} members visible - {sharedFreeWindowCount} shared free windows this week
            </span>
          </div>
        </div>
      </div>
    );
  }, [
    blocks,
    blocksByDay,
    deadlines,
    layout,
    memberMap,
    nowTick,
    sharedFreeWindowCount,
    visibleCount,
    visibleFreeWindowCount,
    visibleFreeWindows,
    visibleMembers,
    visibleMemberSet,
    weekDates,
    weekLabel,
    weekOffset,
  ]);

  return (
    <div className={cn(ds.layout.page, "max-w-none space-y-3")}>
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            CS
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-foreground">CAPSync</div>
            <div className="text-[11px] text-muted-foreground">Group calendar - {weekLabel}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { key: "week", label: "Calendar", hint: "Week grid", icon: "📅" },
            { key: "heat", label: "Heat map", hint: "Density", icon: "▦" },
            { key: "dots", label: "Availability", hint: "Dot grid", icon: "⠿" },
            { key: "free", label: "Free windows", hint: "Clutter-free", icon: "◈" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setLayout(item.key as Layout)}
              className={cn(
                "flex min-w-21 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-center transition-all duration-150",
                layout === item.key
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/70 bg-background text-muted-foreground hover:-translate-y-0.5 hover:border-border hover:text-foreground",
              )}
            >
              <span className="text-sm leading-none">{item.icon}</span>
              <span className="text-[11px] font-medium">{item.label}</span>
              <span className={cn("text-[9px]", layout === item.key ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {item.hint}
              </span>
            </button>
          ))}
        </div>
      </header>

      {weekView}

      <FloatingTooltip
        ref={tooltipElementRef}
        tooltip={hoverTooltip}
        className={cn(ds.calendar.tooltip, "min-w-44")}
        titleClassName={cn(ds.calendar.tooltipTitle)}
        rowClassName={cn(ds.calendar.tooltipRow)}
        dotClassName={cn(ds.calendar.tooltipDot)}
      />

      {showRoutineDialog ? (
        <div className={cn(ds.modal.overlay)} onClick={() => setShowRoutineDialog(false)}>
          <div className={cn(ds.modal.card)} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={cn(ds.modal.closeButton)}
              onClick={() => setShowRoutineDialog(false)}
              aria-label="Close dialog"
            >
              ×
            </button>

            <div className={cn(ds.modal.header)}>
              <div className={cn(ds.modal.badge)}>Routine Setup</div>
              <h2 className={cn(ds.modal.title)}>Create routine</h2>
              <p className={cn(ds.modal.description)}>
                Save recurring routines per account so they appear in your calendars across all circles.
              </p>
            </div>

            <div className={cn(ds.modal.body, "px-4 pb-4 sm:px-6")}>
              <div className={cn(ds.field.wrapper)}>
                <label htmlFor="routine-label" className={cn(ds.field.label)}>
                  Routine name
                </label>
                <input
                  id="routine-label"
                  type="text"
                  value={newRoutineLabel}
                  onChange={(event) => setNewRoutineLabel(event.target.value)}
                  placeholder="e.g., Morning run"
                  className={cn(ds.field.input)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className={cn(ds.field.wrapper)}>
                  <label htmlFor="routine-start" className={cn(ds.field.label)}>
                    Start time
                  </label>
                  <input
                    id="routine-start"
                    type="time"
                    step={60}
                    value={newRoutineStart}
                    onChange={(event) => handleRoutineStartChange(event.target.value)}
                    className={cn(ds.field.input)}
                    min="06:00"
                    max="23:00"
                    required
                  />
                </div>

                <div className={cn(ds.field.wrapper)}>
                  <label htmlFor="routine-end" className={cn(ds.field.label)}>
                    End time
                  </label>
                  <input
                    id="routine-end"
                    type="time"
                    value={newRoutineEnd}
                    onChange={(event) => setNewRoutineEnd(event.target.value)}
                    className={cn(ds.field.input)}
                    min="06:00"
                    max="23:00"
                    step={60}
                    required
                  />
                </div>
              </div>

              <div className={cn(ds.field.wrapper)}>
                <label className={cn(ds.field.label)}>Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((day, index) => {
                    const active = newRoutineDays.includes(index);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setNewRoutineDays((current) =>
                            current.includes(index)
                              ? current.filter((selectedDay) => selectedDay !== index)
                              : [...current, index],
                          );
                        }}
                        className={cn(
                          "h-8 rounded-md border px-3 text-xs font-medium transition-all",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={cn(ds.field.wrapper)}>
                <label htmlFor="routine-color" className={cn(ds.field.label)}>
                  Routine color
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="routine-color"
                    type="color"
                    value={newRoutineColor}
                    onChange={(event) => setNewRoutineColor(event.target.value)}
                    className="h-9 w-11 cursor-pointer rounded-md border border-border/70 bg-background p-1 transition-colors hover:border-border"
                    aria-label="Choose routine color"
                  />
                  {ROUTINE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewRoutineColor(color)}
                      className={cn(
                        "h-7 w-7 rounded-full border border-border/70 transition-all hover:-translate-y-0.5 hover:shadow-sm",
                        newRoutineColor === color && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Pick routine color ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className={cn(ds.modal.actions, "px-4 pb-4 sm:px-6")}>
              <Button type="button" variant="outline" onClick={() => setShowRoutineDialog(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void saveRoutine()}>
                Save routine
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AddMeetingDialog
        open={addMeetingOpen}
        onOpenChange={setAddMeetingOpen}
        groupId={groupId}
        members={members}
        weekStart={weekStart}
        prefillDay={meetingPrefill.day}
        prefillStart={meetingPrefill.start}
        prefillEnd={meetingPrefill.end}
      />
    </div>
  );
}