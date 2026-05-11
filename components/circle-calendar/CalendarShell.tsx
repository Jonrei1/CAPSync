"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import FloatingTooltip, { type FloatingTooltipContent } from "@/components/calendar/FloatingTooltip";
import WeekCalendarGrid, {
  type CalendarGridBadge,
  type CalendarGridEvent,
} from "@/components/calendar/WeekCalendarGrid";
import AddMeetingDialog from "@/components/circle-calendar/AddMeetingDialog";
import EditMeetingDialog from "@/components/circle-calendar/EditMeetingDialog";
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
  groupName: string;
  groupColor: string;
  groupSubject?: string | null;
  weekOffset: number;
  selectedDate: string;
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

const ROUTINE_END_MINUTES = 23 * 60 + 59;
const HEAT_START_HOUR = 7;
const HEAT_END_HOUR = 20;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const ROUTINE_COLORS = ["#4f46e5", "#16a34a", "#ea580c", "#9333ea", "#2563eb", "#ca8a04"];
const HEAT_COLORS = ["#f0fdf4", "#dbeafe", "#93c5fd", "#3b82f6", "#1e3a8a"];
const HEAT_BORDERS = ["#86efac", "#bfdbfe", "#60a5fa", "#1d4ed8", "#172554"];
const HEAT_TEXT = ["#15803d", "#1e40af", "#1e40af", "#ffffff", "#ffffff"];

const VIEW_TABS = [
  { key: "week" as Layout, label: "Calendar",     icon: "📅" },
  { key: "heat" as Layout, label: "Heat map",     icon: "▦"  },
  { key: "dots" as Layout, label: "Availability", icon: "⠿"  },
  { key: "free" as Layout, label: "Free windows", icon: "◈"  },
] as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatTime(hour: number) {
  const whole = Math.floor(hour);
  const period = whole >= 12 ? "PM" : "AM";
  const display = whole % 12 === 0 ? 12 : whole % 12;
  return `${display} ${period}`;
}

function formatTooltipTime(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  const whole = Math.floor(normalized);
  const minutes = Math.round((normalized % 1) * 60);
  const period = whole >= 12 ? "PM" : "AM";
  const display = whole > 12 ? whole - 12 : whole === 0 ? 12 : whole;
  return `${display}:${pad(minutes)} ${period}`;
}

function displayWindowEnd(end: number) {
  return end === 24 ? 23 + 59 / 60 : end;
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

function getWeekDates(anchorDate: Date) {
  const current = new Date(anchorDate);
  current.setHours(12, 0, 0, 0);
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

function getDayKey(date: Date) {
  return DAY_KEYS[date.getDay()];
}

function getTooltipPoint(clientX: number, clientY: number) {
  return {
    x: Math.min(clientX + 14, window.innerWidth - 240),
    y: Math.max(clientY - 8, 8),
  };
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
  const parsed = new Date(
    Number.parseInt(yearPart, 10),
    Number.parseInt(monthPart, 10) - 1,
    Number.parseInt(dayPart, 10),
    12,
    0,
    0,
    0,
  );

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function toDateParam(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return `${normalized.getFullYear()}-${pad(normalized.getMonth() + 1)}-${pad(normalized.getDate())}`;
}

export default function CalendarShell({
  members,
  blocks,
  freeWindows,
  deadlines,
  groupId,
  groupName,
  groupColor,
  groupSubject,
  weekOffset: _weekOffset,
  selectedDate,
}: CalendarShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ds = useDesignStandard();
  const [layout, setLayout] = useState<Layout>("week");
  const [visibleMemberIds, setVisibleMemberIds] = useState<string[]>(() => members.map((member) => member.id));
  const [addMeetingOpen, setAddMeetingOpen] = useState(false);
  const [meetingPrefill, setMeetingPrefill] = useState<MeetingPrefill>({});
  const [editMeetingOpen, setEditMeetingOpen] = useState(false);
  const [editMeetingId, setEditMeetingId] = useState<string | null>(null);
  const [editMeetingMode, setEditMeetingMode] = useState<"edit" | "delete" | "view">("edit");
  const [showRoutineDialog, setShowRoutineDialog] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("Unknown");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [newScheduleLabel, setNewScheduleLabel] = useState("");
  const [newScheduleDate, setNewScheduleDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
  const [newScheduleStart, setNewScheduleStart] = useState("09:00");
  const [newScheduleEnd, setNewScheduleEnd] = useState("10:00");
  const [newScheduleColor, setNewScheduleColor] = useState(ROUTINE_COLORS[0]);
  const [newScheduleDetails, setNewScheduleDetails] = useState("");
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

  const activeDate = useMemo(() => parseDateParam(selectedDate) ?? new Date(), [selectedDate]);
  const weekDates = useMemo(() => getWeekDates(activeDate), [activeDate]);
  const weekStart = weekDates[0];
  const weekLabel = useMemo(() => formatRange(weekDates[0], weekDates[6]), [weekDates]);
  const visibleMemberSet = useMemo(() => new Set(visibleMemberIds), [visibleMemberIds]);

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.id, member] as const)),
    [members],
  );
  const memberIds = useMemo(() => members.map((member) => member.id), [members]);

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

  const minFreeMembers = Math.max(2, visibleCount - 1);
  const visibleFreeWindows = useMemo(
    () =>
      freeWindows.filter(
        (window) => window.memberIds.filter((memberId) => visibleMemberSet.has(memberId)).length >= minFreeMembers,
      ),
    [freeWindows, minFreeMembers, visibleMemberSet],
  );

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
    let mounted = true;
    async function loadUserName() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      setCurrentUserId(user.id);
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();
      if (mounted) {
        setCurrentUserName(
          data?.full_name?.trim() || data?.email?.split("@")[0] || "Unknown"
        );
      }
    }
    void loadUserName();
    return () => { mounted = false; };
  }, []);

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
    let channel = supabase.channel(`circle-calendar:${groupId}`);

    for (const memberId of memberIds) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "personal_routines",
          filter: `user_id=eq.${memberId}`,
        },
        () => router.refresh(),
      );
    }

    channel = channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "schedules",
        filter: `group_id=eq.${groupId}`,
      },
      () => router.refresh(),
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, memberIds, router]);

  function navigateToDate(nextDate: Date) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("week");
    nextParams.set("date", toDateParam(nextDate));

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

  function handleScheduleAction(scheduleId: string, action: "edit" | "delete" | "view") {
    setEditMeetingId(scheduleId);
    setEditMeetingMode(action);
    setEditMeetingOpen(true);
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

  function resetScheduleForm() {
    setNewScheduleLabel("");
    setNewScheduleDetails("");
    const now = new Date();
    setNewScheduleDate(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    );
    setNewScheduleStart("09:00");
    setNewScheduleEnd("10:00");
    setNewScheduleColor(ROUTINE_COLORS[0]);
  }

  async function saveSchedule() {
    if (!newScheduleLabel.trim()) {
      toast({ title: "Please enter an activity name." });
      return;
    }
    const [sh, sm] = newScheduleStart.split(":").map(Number);
    const [eh, em] = newScheduleEnd.split(":").map(Number);
    const startHour = (sh ?? 0) + (sm ?? 0) / 60;
    const endHour = (eh ?? 0) + (em ?? 0) / 60;
    if (endHour <= startHour) {
      toast({ title: "End time must be after start time." });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("scheduled_blocks").insert({
      user_id: user.id,
      label: newScheduleLabel.trim(),
      details: newScheduleDetails.trim() || null,
      color: newScheduleColor,
      scheduled_date: newScheduleDate,
      start_time: newScheduleStart,
      end_time: newScheduleEnd,
    });

    if (error) {
      toast({ title: "Failed to save schedule.", description: error.message });
      return;
    }

    toast.success("Schedule added");
    setShowScheduleDialog(false);
    resetScheduleForm();
    router.refresh();
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

    const { data: insertedRoutine, error } = await supabase
      .from("personal_routines")
      .insert({
        user_id: userId,
        label: newRoutineLabel.trim(),
        details: "Personal",
        color: newRoutineColor,
        days_of_week: newRoutineDays,
        start_time: newRoutineStart,
        end_time: newRoutineEnd,
        is_active: true,
      })
      .select("id")
      .single();

    if (error || !insertedRoutine) {
      toast({ title: "Failed to save routine", description: error?.message ?? "Insert did not return a row." });
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
      const nextEndMinutes = Math.min(nextStartMinutes + 60, ROUTINE_END_MINUTES);
      const hours = Math.floor(nextEndMinutes / 60);
      const minutes = nextEndMinutes % 60;
      setNewRoutineEnd(`${pad(hours)}:${pad(minutes)}`);
    }
  }

  const weekView = useMemo(() => {
    const dayIndexByKey = new Map<string, number>(DAY_KEYS.map((key, index) => [key, index]));
    const foregroundEvents: CalendarGridEvent[] = [];
    const backgroundEvents: CalendarGridEvent[] = [];
    const deadlineBadges: CalendarGridBadge[] = [];

    for (const block of visibleBlocks) {
      const member = memberMap.get(block.memberId);
      if (!member) {
        continue;
      }

      for (const dayKey of block.days) {
        const dayIndex = dayIndexByKey.get(dayKey);
        if (dayIndex === undefined) {
          continue;
        }

        const durationHours = Math.floor(block.e - block.s);
        const durationMinutes = Math.round((block.e - block.s - durationHours) * 60);
        const durationStr = durationHours > 0
          ? `${durationHours} hr${durationHours > 1 ? "s" : ""}${durationMinutes > 0 ? ` ${durationMinutes} min` : ""}`
          : `${durationMinutes} min`;

        const tooltipRows = [
          { dot: member.bg, text: `${member.name} - ${member.role}` },
          { text: `${formatTooltipTime(block.s)} - ${formatTooltipTime(block.e)}` },
          { text: durationStr },
          ...(block.sub ? [{ text: block.sub }] : []),
          { text: block.routine ? "Recurring routine" : "Scheduled meeting" },
          ...(block.lastEditedByName ? [{ text: `Edited by ${block.lastEditedByName}`, italic: true }] : []),
        ];

        // Build enhanced subtitle with time and meeting indicator for schedules
        const subtitleParts = [];
        if (!block.routine) {
          subtitleParts.push("📅 Meeting");
        }
        subtitleParts.push(`${formatTooltipTime(block.s)} - ${formatTooltipTime(block.e)}`);
        const enhancedSubtitle = subtitleParts.join(" ");

        foregroundEvents.push({
          id: `${block.memberId}-${dayKey}-${block.s}-${block.e}-${block.lbl}`,
          dayIndex,
          startHour: block.s,
          endHour: block.e,
          title: block.lbl,
          subtitle: enhancedSubtitle,
          tag: member.name,
          tag2: durationStr,
          color: member.bg,
          variant: block.routine ? "pattern" : "solid",
          isSchedule: !block.routine,
          createdById: block.creatorId,
          scheduleId: block.id ?? undefined,
          link: (block.sub && block.sub !== "Personal" && block.sub !== "Routine" && block.sub !== "Personal routine") ? block.sub : undefined,
          onClick: block.id ? () => handleScheduleAction(block.id!, "view") : undefined,
          tooltip: { title: block.lbl, rows: tooltipRows },
        });
      }
    }

    for (const window of visibleFreeWindows) {
      for (const dayKey of window.days) {
        const dayIndex = dayIndexByKey.get(dayKey);
        if (dayIndex === undefined) {
          continue;
        }

        const visibleMembersInWindow = window.memberIds.filter((memberId) => visibleMemberSet.has(memberId));
        const isAllVisible = visibleMembersInWindow.length >= visibleCount;
        const memberRows = visibleMembersInWindow
          .map((memberId) => memberMap.get(memberId))
          .filter((member): member is CalendarMember => Boolean(member))
          .map((member) => ({ dot: member.bg, text: `${member.name} is free` }));

        const windowEnd = displayWindowEnd(window.e);

        backgroundEvents.push({
          id: `window-${dayKey}-${window.s}-${window.e}`,
          dayIndex,
          startHour: window.s,
          endHour: window.e,
          title: isAllVisible ? "All free" : "Available",
          subtitle: `${formatTooltipTime(window.s)} - ${formatTooltipTime(windowEnd)}`,
          tag: window.dur,
          color: "#16a34a",
          variant: "window",
          onClick: () => openAddMeeting(dayKey, window.s, window.e),
          tooltip: {
            title: "Free window",
            rows: [
              { dot: "#16a34a", text: `${formatTooltipTime(window.s)} - ${formatTooltipTime(windowEnd)}` },
              { text: window.dur },
              ...memberRows,
            ],
          },
        });
      }
    }

    deadlines.forEach((deadline, index) => {
      deadline.days.forEach((dayKey) => {
        const dayIndex = dayIndexByKey.get(dayKey);
        if (dayIndex === undefined) {
          return;
        }

        deadlineBadges.push({
          id: `deadline-${dayKey}-${index}`,
          dayIndex,
          label: deadline.lbl,
          color: "#dc2626",
          tooltip: { title: "Deadline", rows: [{ dot: "#dc2626", text: deadline.lbl }] },
        });
      });
    });

    return (
      <div className="min-h-0 flex-1 flex flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/30 px-3 py-1.5 sm:px-4">
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
                      "group flex items-center gap-[7px] rounded-[7px] border-[1.5px] min-h-[34px] px-[10px] py-[5px] pl-[8px] text-left transition-all duration-150 select-none",
                      visible
                        ? "bg-background shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                        : "border-border/70 bg-muted/60 opacity-45",
                    )}
                    style={{ borderColor: visible ? member.bd : undefined }}
                  >
                    <div
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: member.bg, opacity: visible ? 1 : 0.45 }}
                    />
                    <div className="min-w-0 flex-1 flex flex-col items-start">
                      <span className="truncate text-[11px] font-semibold leading-[1.2] text-foreground" style={{ color: visible ? member.bg : undefined }}>
                        {member.name}
                      </span>
                      <span className="text-[9px] leading-[1.2] text-muted-foreground mt-px">
                        {member.role} · {blockCount} blocks
                      </span>
                    </div>
                    <div
                      className={cn(
                        "ml-[2px] flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[8px] font-bold transition-colors",
                        visible ? "text-white" : "border-border/70 bg-transparent text-muted-foreground",
                      )}
                      style={visible ? { borderColor: member.bg, backgroundColor: member.bg } : undefined}
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

          <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
            {layout === "week" ? (
              <WeekCalendarGrid
                weekDates={weekDates}
                foregroundEvents={foregroundEvents}
                backgroundEvents={backgroundEvents}
                badges={deadlineBadges}
                now={nowTick}
                selectedDate={activeDate}
                startHour={5}
                endHour={24}
                tooltipClassName={ds.calendar.tooltip}
                tooltipTitleClassName={ds.calendar.tooltipTitle}
                tooltipRowClassName={ds.calendar.tooltipRow}
                tooltipDotClassName={ds.calendar.tooltipDot}
                currentUserId={currentUserId ?? undefined}
                onScheduleAction={handleScheduleAction}
              />
            ) : null}

            {layout === "heat" ? (
            <div className="max-h-142 overflow-y-auto space-y-4 p-4 sm:p-5 [scrollbar-gutter:stable]">
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
            <div className="max-h-142 overflow-y-auto space-y-4 p-4 sm:p-5 [scrollbar-gutter:stable]">
              <div className="overflow-x-auto">
                <div className="min-w-205 space-y-5">
                  <div className="flex pl-24 pb-1 text-[8px] uppercase tracking-[0.08em] text-muted-foreground">
                    {Array.from({ length: 13 }, (_, index) => index + 7).map((hour) => (
                      <div key={hour} className="flex-1 text-center">
                        {formatTime(hour)}
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
            <div className="max-h-142 overflow-y-auto space-y-4 p-4 sm:p-5 [scrollbar-gutter:stable]">
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
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground sm:px-4">
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
    deadlines,
    ds,
    layout,
    memberBlockCounts,
    memberMap,
    members,
    nowTick,
    sharedFreeWindowCount,
    visibleBlocks,
    visibleCount,
    visibleFreeWindows,
    visibleMembers,
    visibleMemberSet,
    weekDates,
    weekLabel,
  ]);

  return (
    <div className={cn(ds.layout.page, "max-w-none flex h-full flex-col gap-1 py-0")}>
      <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden mb-2">
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border/70">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-background px-2 text-[11px] font-medium whitespace-nowrap text-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              <span className="mr-1" aria-hidden="true">&larr;</span>
              Back
            </Link>

            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
              {groupName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "GC"}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-foreground truncate max-w-55">{groupName}</div>
              <div className="hidden sm:block text-[11px] text-muted-foreground truncate">{groupSubject} · {weekLabel}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setLayout(tab.key)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-all",
                  layout === tab.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-transparent text-muted-foreground hover:border-border/70 hover:text-foreground",
                )}
              >
                <span className="text-xs leading-none">{tab.icon}</span>
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="icon-sm" onClick={() => navigateToDate(addDays(activeDate, -7))}>&#8249;</Button>
            <Button variant="outline" size="sm"      onClick={() => navigateToDate(new Date())}>Today</Button>
            <Button variant="outline" size="icon-sm" onClick={() => navigateToDate(addDays(activeDate, 7))}>&#8250;</Button>

            <span className="text-sm font-medium text-foreground min-w-30 text-center hidden sm:inline">{weekLabel}</span>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Go to date</span>

              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger
                  render={(
                    <Button
                      variant="outline"
                      data-empty={!activeDate}
                      className="w-53 justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                    >
                      {activeDate ? format(activeDate, "PPP") : <span>Pick a date</span>}
                      <ChevronDownIcon data-icon="inline-end" />
                    </Button>
                  )}
                />
                <PopoverContent className={cn(ds.calendar.dateJumpPopover)} align="start">
                  <Calendar
                    mode="single"
                    selected={activeDate}
                    defaultMonth={activeDate}
                    onSelect={(nextDate) => {
                      if (!nextDate) {
                        return;
                      }

                      navigateToDate(nextDate);
                      setDatePickerOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowScheduleDialog(true)}>
              <span className="hidden sm:inline">Add schedule</span>
              <span className="sm:hidden">+ Schedule</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowRoutineDialog(true)}>
              <span className="hidden sm:inline">Add routine</span>
              <span className="sm:hidden">+ Routine</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={doSuggest}>
              <span className="hidden md:inline">Suggest meeting</span>
              <span className="md:hidden">Suggest</span>
            </Button>
          </div>
        </div>
      </div>

      {weekView}

      {layout === "week" ? null : (
        <FloatingTooltip
          ref={tooltipElementRef}
          tooltip={hoverTooltip}
          className={cn(ds.calendar.tooltip, "min-w-44")}
          titleClassName={cn(ds.calendar.tooltipTitle)}
          rowClassName={cn(ds.calendar.tooltipRow)}
          dotClassName={cn(ds.calendar.tooltipDot)}
        />
      )}

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
                    min="00:00"
                    max="23:59"
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
                    min="00:00"
                    max="23:59"
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

      {showScheduleDialog && (
        <div
          className={cn(ds.modal.overlay)}
          onClick={() => { setShowScheduleDialog(false); resetScheduleForm(); }}
        >
          <div className={cn(ds.modal.card)} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={cn(ds.modal.closeButton)}
              onClick={() => { setShowScheduleDialog(false); resetScheduleForm(); }}
              aria-label="Close"
            >×</button>

            <div className={cn(ds.modal.header)}>
              <div className={cn(ds.modal.badge)}>One-off Schedule</div>
              <h2 className={cn(ds.modal.title)}>Add schedule</h2>
              <p className={cn(ds.modal.description)}>
                Add a personal one-time activity block to this week. It will not repeat.
              </p>
            </div>

            <div className={cn(ds.modal.body, "px-4 pb-4 sm:px-6")}>
              <div className={cn(ds.field.wrapper)}>
                <label htmlFor="cs-sched-label" className={cn(ds.field.label)}>Activity name</label>
                <input
                  id="cs-sched-label"
                  type="text"
                  value={newScheduleLabel}
                  onChange={(e) => setNewScheduleLabel(e.target.value)}
                  placeholder="e.g. Research review"
                  className={cn(ds.field.input)}
                />
              </div>

              <div className={cn(ds.field.wrapper)}>
                <label htmlFor="cs-sched-details" className={cn(ds.field.label)}>Details (optional)</label>
                <input
                  id="cs-sched-details"
                  type="text"
                  value={newScheduleDetails}
                  onChange={(e) => setNewScheduleDetails(e.target.value)}
                  placeholder="e.g. Library session"
                  className={cn(ds.field.input)}
                />
              </div>

              <div className={cn(ds.field.wrapper)}>
                <label htmlFor="cs-sched-date" className={cn(ds.field.label)}>Date</label>
                <input
                  id="cs-sched-date"
                  type="date"
                  value={newScheduleDate}
                  onChange={(e) => setNewScheduleDate(e.target.value)}
                  className={cn(ds.field.input)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className={cn(ds.field.wrapper)}>
                  <label htmlFor="cs-sched-start" className={cn(ds.field.label)}>Start time</label>
                  <input
                    id="cs-sched-start"
                    type="time"
                    value={newScheduleStart}
                    onChange={(e) => {
                      setNewScheduleStart(e.target.value);
                      const [sh, sm] = e.target.value.split(":").map(Number);
                      const [eh, em] = newScheduleEnd.split(":").map(Number);
                      if ((eh ?? 0) * 60 + (em ?? 0) <= (sh ?? 0) * 60 + (sm ?? 0)) {
                        const next = (sh ?? 0) * 60 + (sm ?? 0) + 60;
                        setNewScheduleEnd(`${pad(Math.floor(next / 60))}:${pad(next % 60)}`);
                      }
                    }}
                    className={cn(ds.field.input)}
                    min="00:00" max="23:59" step={60}
                  />
                </div>
                <div className={cn(ds.field.wrapper)}>
                  <label htmlFor="cs-sched-end" className={cn(ds.field.label)}>End time</label>
                  <input
                    id="cs-sched-end"
                    type="time"
                    value={newScheduleEnd}
                    onChange={(e) => setNewScheduleEnd(e.target.value)}
                    className={cn(ds.field.input)}
                    min="00:00" max="23:59" step={60}
                  />
                </div>
              </div>

              <div className={cn(ds.field.wrapper)}>
                <label htmlFor="cs-sched-color" className={cn(ds.field.label)}>Color</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="cs-sched-color"
                    type="color"
                    value={newScheduleColor}
                    onChange={(e) => setNewScheduleColor(e.target.value)}
                    className="h-9 w-11 cursor-pointer rounded-md border border-border/70 bg-background p-1"
                  />
                  {ROUTINE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewScheduleColor(color)}
                      className={cn(
                        "h-7 w-7 rounded-full border border-border/70 transition-all hover:-translate-y-0.5",
                        newScheduleColor === color && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Pick color ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className={cn(ds.modal.actions, "px-4 pb-4 sm:px-6")}>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowScheduleDialog(false); resetScheduleForm(); }}
              >Cancel</Button>
              <Button type="button" onClick={() => void saveSchedule()}>
                Add to calendar
              </Button>
            </div>
          </div>
        </div>
      )}

      <AddMeetingDialog
        open={addMeetingOpen}
        onOpenChange={setAddMeetingOpen}
        groupId={groupId}
        groupName={groupName}
        groupColor={groupColor}
        members={members}
        weekStart={weekStart}
        prefillDay={meetingPrefill.day}
        prefillStart={meetingPrefill.start}
        prefillEnd={meetingPrefill.end}
        creatorName={currentUserName}
      />

      <EditMeetingDialog
        open={editMeetingOpen}
        onOpenChange={setEditMeetingOpen}
        groupId={groupId}
        groupName={groupName}
        groupColor={groupColor}
        members={members}
        scheduleId={editMeetingId}
        mode={editMeetingMode}
      />
    </div>
  );
}