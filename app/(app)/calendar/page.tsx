"use client";

import { useEffect, useMemo, useState } from "react";
import supabase from "@/lib/supabaseClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import styles from "./page.module.css";

type CircleRow = {
  id: string;
  name: string;
  color: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  group_id: string;
  starts_at?: string | null;
  ends_at?: string | null;
};

type RoutineRow = {
  id: string;
  label: string;
  sub: string;
  color: string;
  days: number[];
  startHour: number;
  endHour: number;
};

type Density = "all" | "tasks" | "routines";
type Layout = "week" | "focus";

type HoverTooltip = {
  x: number;
  y: number;
  title: string;
  rows: Array<{ text: string; dot?: string }>;
};

const SLOT = 52;
const START_HOUR = 6;
const END_HOUR = 23;
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const ROUTINE_COLORS = ["#4f46e5", "#16a34a", "#ea580c", "#9333ea", "#2563eb", "#ca8a04"];

function formatTime(hour: number) {
  const h = Math.floor(hour);
  const period = h >= 12 ? "P" : "A";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}${period}`;
}

function formatTooltipTime(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  const h = Math.floor(normalized);
  const mm = Math.round((normalized % 1) * 60);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${mm.toString().padStart(2, "0")} ${period}`;
}

function parseTimeHour(value: string) {
  const [hours] = value.split(":");
  const parsed = Number.parseInt(hours ?? "", 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(parsed, 23));
}

function toHourTimeValue(hour: number) {
  const clamped = Math.max(0, Math.min(hour, 23));
  return `${String(clamped).padStart(2, "0")}:00`;
}

function toHourTimeLabel(hour: number) {
  return formatTooltipTime(hour).replace(":00 ", " ");
}

const ROUTINE_TIME_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  value: toHourTimeValue(hour),
  label: toHourTimeLabel(hour),
}));

function toRgba(color: string, alpha: number) {
  const cleaned = color.trim();
  const fullHex = cleaned.startsWith("#") ? cleaned.slice(1) : cleaned;
  const normalized =
    fullHex.length === 3
      ? `${fullHex[0]}${fullHex[0]}${fullHex[1]}${fullHex[1]}${fullHex[2]}${fullHex[2]}`
      : fullHex;

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

function formatDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function toDisplayRange(start: Date, end: Date) {
  const opts = { month: "short", day: "numeric" } as const;
  return `${start.toLocaleDateString("en-PH", opts)} - ${end.toLocaleDateString("en-PH", opts)}`;
}

export default function MainCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [layout] = useState<Layout>("week");
  const [density, setDensity] = useState<Density>("all");
  const [activeDate, setActiveDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [weekStart, setWeekStart] = useState(() => startOfWeek(activeDate));
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [visibleCircleIds, setVisibleCircleIds] = useState<string[]>([]);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null);
  const [showRoutineDialog, setShowRoutineDialog] = useState(false);
  const [newRoutineLabel, setNewRoutineLabel] = useState("");
  const [newRoutineStart, setNewRoutineStart] = useState("09:00");
  const [newRoutineEnd, setNewRoutineEnd] = useState("10:00");
  const [newRoutineDays, setNewRoutineDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newRoutineColor, setNewRoutineColor] = useState(ROUTINE_COLORS[0]);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const weekLabel = useMemo(() => toDisplayRange(weekDates[0], weekDates[6]), [weekDates]);
  const selectedStartHour = useMemo(() => parseTimeHour(newRoutineStart), [newRoutineStart]);
  const routineStartTimeOptions = useMemo(() => ROUTINE_TIME_OPTIONS.slice(0, 23), []);
  const routineEndTimeOptions = useMemo(
    () => ROUTINE_TIME_OPTIONS.filter((option) => option.hour > selectedStartHour),
    [selectedStartHour],
  );
  const activeYear = activeDate.getFullYear();
  const activeMonth = activeDate.getMonth() + 1;
  const activeDay = activeDate.getDate();
  const jumpYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 101 }, (_, i) => currentYear - 50 + i);
  }, []);
  const jumpDayOptions = useMemo(
    () => Array.from({ length: getDaysInMonth(activeYear, activeMonth) }, (_, i) => i + 1),
    [activeYear, activeMonth],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const task of tasks) {
      if (!task.due_date) {
        continue;
      }
      if (!map.has(task.due_date)) {
        map.set(task.due_date, []);
      }
      map.get(task.due_date)?.push(task);
    }
    return map;
  }, [tasks]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      if (!userId) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      const [circlesResult, routinesResult] = await Promise.all([
        supabase
          .from("group_members")
          .select("group_id, groups(id, name, color)")
          .eq("member_id", userId),
        supabase
          .from("personal_routines")
          .select("id, label, details, color, days_of_week, start_time, end_time, is_active")
          .eq("user_id", userId)
          .eq("is_active", true),
      ]);

      if (!mounted) {
        return;
      }

      const normalizedCircles = (circlesResult.data ?? [])
        .map((row) => {
          const joined = row as { groups: CircleRow | CircleRow[] | null };
          if (Array.isArray(joined.groups)) {
            return joined.groups[0] ?? null;
          }
          return joined.groups;
        })
        .filter((row): row is CircleRow => Boolean(row));

      setCircles(normalizedCircles);
      setVisibleCircleIds(normalizedCircles.map((circle) => circle.id));

      const mappedRoutines = (routinesResult.data ?? [])
        .map((row) => {
          const next = row as {
            id: string;
            label: string;
            details: string | null;
            color: string | null;
            days_of_week: number[];
            start_time: string;
            end_time: string;
          };

          const startParts = next.start_time.split(":").map(Number);
          const endParts = next.end_time.split(":").map(Number);
          const startHour = (startParts[0] ?? 0) + (startParts[1] ?? 0) / 60;
          const endHour = (endParts[0] ?? 0) + (endParts[1] ?? 0) / 60;

          return {
            id: next.id,
            label: next.label,
            sub: next.details ?? "Personal",
            color: next.color ?? "#374151",
            days: next.days_of_week,
            startHour,
            endHour,
          } satisfies RoutineRow;
        })
        .filter((routine) => routine.days.length > 0 && routine.endHour > routine.startHour);

      setRoutines(mappedRoutines);

      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadTasks() {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

      if (!userId) {
        if (mounted) {
          setTasks([]);
        }
        return;
      }

      const start = formatDay(weekDates[0]);
      const end = formatDay(weekDates[6]);

      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date, status, group_id, starts_at, ends_at")
        .eq("assigned_to", userId)
        .gte("due_date", start)
        .lte("due_date", end)
        .order("due_date", { ascending: true });

      if (!mounted) {
        return;
      }

      setTasks((data as TaskRow[]) ?? []);
    }

    void loadTasks();

    return () => {
      mounted = false;
    };
  }, [weekDates]);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => visibleCircleIds.includes(task.group_id)),
    [tasks, visibleCircleIds],
  );

  const visibleTaskCount = visibleTasks.length;
  const activeRoutineCount = useMemo(
    () => routines.filter((routine) => routine.days.length > 0).length,
    [routines],
  );
  const shownCircleCount = useMemo(
    () => circles.filter((circle) => visibleCircleIds.includes(circle.id)).length,
    [circles, visibleCircleIds],
  );

  const circleMap = useMemo(() => {
    const map = new Map<string, CircleRow>();
    for (const circle of circles) {
      map.set(circle.id, circle);
    }
    return map;
  }, [circles]);

  function syncCalendarDate(nextDate: Date) {
    const normalized = new Date(nextDate);
    normalized.setHours(0, 0, 0, 0);
    setActiveDate(normalized);
    setWeekStart(startOfWeek(normalized));
  }

  function syncCalendarDateParts(nextYear: number, nextMonth: number, nextDay: number) {
    const maxDay = getDaysInMonth(nextYear, nextMonth);
    const safeDay = Math.min(nextDay, maxDay);
    syncCalendarDate(new Date(nextYear, nextMonth - 1, safeDay));
  }

  function toggleCircle(circleId: string) {
    setVisibleCircleIds((current) =>
      current.includes(circleId) ? current.filter((id) => id !== circleId) : [...current, circleId],
    );
  }

  async function saveRoutine() {
    if (!newRoutineLabel.trim()) {
      alert("Please enter a routine name");
      return;
    }

    if (newRoutineDays.length === 0) {
      alert("Please select at least one day");
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
      return;
    }

    const startParts = newRoutineStart.split(":").map(Number);
    const endParts = newRoutineEnd.split(":").map(Number);
    const startHour = (startParts[0] ?? 0) + (startParts[1] ?? 0) / 60;
    const endHour = (endParts[0] ?? 0) + (endParts[1] ?? 0) / 60;

    if (endHour <= startHour) {
      alert("End time must be later than start time");
      return;
    }

    const { error } = await supabase.from("personal_routines").insert({
      user_id: userId,
      label: newRoutineLabel,
      details: "Personal",
      color: newRoutineColor,
      days_of_week: newRoutineDays,
      start_time: newRoutineStart,
      end_time: newRoutineEnd,
      is_active: true,
    });

    if (error) {
      console.error("Error saving routine:", error);
      alert("Failed to save routine");
      return;
    }

    setRoutines((current) => [
      ...current,
      {
        id: `routine-${Date.now()}`,
        label: newRoutineLabel,
        sub: "Personal",
        color: newRoutineColor,
        days: newRoutineDays,
        startHour,
        endHour,
      },
    ]);

    setShowRoutineDialog(false);
    setNewRoutineLabel("");
    setNewRoutineStart("09:00");
    setNewRoutineEnd("10:00");
    setNewRoutineDays([1, 2, 3, 4, 5]);
    setNewRoutineColor(ROUTINE_COLORS[0]);
  }

  function setAllVisible(nextVisible: boolean) {
    if (nextVisible) {
      setVisibleCircleIds(circles.map((circle) => circle.id));
      return;
    }
    setVisibleCircleIds([]);
  }

  function handleRoutineStartChange(nextValue: string) {
    setNewRoutineStart(nextValue);
    const nextStartHour = parseTimeHour(nextValue);
    const currentEndHour = parseTimeHour(newRoutineEnd);

    if (currentEndHour <= nextStartHour) {
      setNewRoutineEnd(toHourTimeValue(Math.min(nextStartHour + 1, 23)));
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.appBar}>
        <div className={styles.appId}>
          <div>
            <div className={styles.appName}>My Calendar</div>
            <div className={styles.appSub}>Personal view - Week of {weekLabel}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }} />
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarRow}>
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => syncCalendarDate(addDays(activeDate, -7))}
            >
              &lt;
            </button>
            <button className={`${styles.btn} ${styles.btnOutline}`} onClick={() => syncCalendarDate(new Date())}>
              Today
            </button>
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => syncCalendarDate(addDays(activeDate, 7))}
            >
              &gt;
            </button>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{weekLabel}</span>
            <div className={styles.dateJump}>
              <span className={styles.dateJumpLabel}>Go to date</span>
              <Select
                value={String(activeMonth)}
                onValueChange={(value) => syncCalendarDateParts(activeYear, Number(value), activeDay)}
              >
                <SelectTrigger className={styles.dateJumpSelect}>
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_LABELS.map((month, idx) => (
                    <SelectItem key={month} value={String(idx + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(activeDay)}
                onValueChange={(value) => syncCalendarDateParts(activeYear, activeMonth, Number(value))}
              >
                <SelectTrigger className={styles.dateJumpSelectDay}>
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {jumpDayOptions.map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(activeYear)}
                onValueChange={(value) => syncCalendarDateParts(Number(value), activeMonth, activeDay)}
              >
                <SelectTrigger className={styles.dateJumpSelectYear}>
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {jumpYearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={styles.toolbarRow}>
            <button className={`${styles.btn} ${styles.btnOutline}`}>Import schedule</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowRoutineDialog(true)}>+ Add routine</button>
          </div>
        </div>

        <div className={styles.filterPanel}>
          <span className={styles.filterLabel}>Circles</span>
          <div className={styles.chips}>
            {circles.map((circle) => {
              const active = visibleCircleIds.includes(circle.id);
              const color = circle.color ?? "#4f46e5";
              const routineCount = activeRoutineCount;
              const taskCount = visibleTasks.filter((task) => task.group_id === circle.id).length;
              return (
                <button
                  key={circle.id}
                  type="button"
                  onClick={() => toggleCircle(circle.id)}
                  className={`${styles.circleChip} ${active ? "" : styles.circleChipOff}`}
                  style={{ borderColor: color }}
                >
                  <span className={styles.circleDot} style={{ backgroundColor: color }} />
                  <span>
                    <span className={styles.circleName} style={{ color }}>
                      {circle.name}
                    </span>
                    <span className={styles.circleSub}>{routineCount} routines · {taskCount} tasks assigned</span>
                  </span>
                  <span
                    className={styles.circleChipCheck}
                    style={{ borderColor: active ? color : "#d1d5db", backgroundColor: active ? color : "transparent" }}
                  >
                    {active ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              {shownCircleCount} of {circles.length} circles shown
            </span>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setAllVisible(true)}>
              Show all
            </button>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setAllVisible(false)}>
              Hide all
            </button>
          </div>
        </div>

        <div className={styles.densityBar}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Density</span>
          <div className={styles.densityToggle}>
            {[
              { key: "all", label: "Routines + Tasks" },
              { key: "tasks", label: "Tasks only" },
              { key: "routines", label: "Routines only" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`${styles.densityBtn} ${density === item.key ? styles.densityBtnActive : ""}`}
                onClick={() => setDensity(item.key as Density)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {layout === "week" ? (
          <>
            <div className={styles.scroll}>
              <div className={styles.weekHead}>
                <div className={styles.weekHeadSpacer} />
                {weekDates.map((date, dayIndex) => {
                  const isToday = formatDay(date) === formatDay(new Date());
                  return (
                    <div key={dayIndex} className={styles.dayHeader}>
                      <div className={styles.dayName}>{WEEK_DAYS[dayIndex]}</div>
                      {isToday ? (
                        <div className={styles.dayNumToday}>{date.getDate()}</div>
                      ) : (
                        <div className={styles.dayNum}>{date.getDate()}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className={styles.grid}>
                <div className={styles.timeCol}>
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
                    const hour = START_HOUR + i;
                    const label = formatTime(hour);
                    return (
                      <div key={i} className={styles.timeCell}>
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>

                {weekDates.map((date, dayIndex) => {
                  const dateKey = formatDay(date);
                  const isToday = dateKey === formatDay(new Date());
                  const dayTasks = (tasksByDay.get(dateKey) ?? []).filter((task) =>
                    visibleCircleIds.includes(task.group_id),
                  );

                  const routineEvents: Array<{
                    id: string;
                    top: number;
                    height: number;
                    startHour: number;
                    endHour: number;
                    title: string;
                    sub: string;
                    color: string;
                    compact: boolean;
                  }> = [];

                  const taskEvents: Array<{
                    id: string;
                    top: number;
                    height: number;
                    startHour: number;
                    endHour: number;
                    left: number;
                    width: number;
                    title: string;
                    sub: string;
                    color: string;
                    compact: boolean;
                  }> = [];

                  if (density !== "tasks") {
                    for (const routine of routines) {
                      if (!routine.days.includes(dayIndex)) {
                        continue;
                      }
                      routineEvents.push({
                        id: routine.id,
                        top: (routine.startHour - START_HOUR) * SLOT,
                        height: (routine.endHour - routine.startHour) * SLOT,
                        startHour: routine.startHour,
                        endHour: routine.endHour,
                        title: routine.label,
                        sub: routine.sub,
                        color: routine.color,
                        compact: routine.endHour - routine.startHour <= 0.85,
                      });
                    }
                  }

                  if (density !== "routines") {
                    dayTasks.forEach((task, index) => {
                      const circle = circleMap.get(task.group_id);
                      const color = circle?.color ?? "#4f46e5";
                      const startAt = task.starts_at ? new Date(task.starts_at) : null;
                      const endAt = task.ends_at ? new Date(task.ends_at) : null;

                      const startHour =
                        startAt && !Number.isNaN(startAt.getTime())
                          ? startAt.getHours() + startAt.getMinutes() / 60
                          : 9 + index * 0.6;

                      const endHour =
                        endAt && !Number.isNaN(endAt.getTime())
                          ? endAt.getHours() + endAt.getMinutes() / 60
                          : startHour + 1;

                      taskEvents.push({
                        id: task.id,
                        top: (startHour - START_HOUR) * SLOT,
                        height: Math.max((endHour - startHour) * SLOT, 36),
                        startHour,
                        endHour,
                        left: 0,
                        width: 100,
                        title: task.title,
                        sub: `${circle?.name ?? "Circle"} · ${task.status}`,
                        color,
                        compact: endHour - startHour <= 0.85,
                      });
                    });

                    const sorted = [...taskEvents].sort((a, b) =>
                      a.startHour !== b.startHour ? a.startHour - b.startHour : b.endHour - a.endHour,
                    );

                    const slotEndTimes: number[] = [];
                    for (const event of sorted) {
                      let slot = -1;
                      for (let idx = 0; idx < slotEndTimes.length; idx += 1) {
                        if (slotEndTimes[idx] <= event.startHour + 0.01) {
                          slot = idx;
                          break;
                        }
                      }
                      if (slot === -1) {
                        slot = slotEndTimes.length;
                        slotEndTimes.push(event.endHour);
                      } else {
                        slotEndTimes[slot] = event.endHour;
                      }
                      event.left = slot;
                    }

                    for (const event of sorted) {
                      let maxSlot = event.left;
                      for (const other of sorted) {
                        const overlap = other.startHour < event.endHour && other.endHour > event.startHour;
                        if (overlap) {
                          maxSlot = Math.max(maxSlot, other.left);
                        }
                      }
                      const cols = maxSlot + 1;
                      event.width = 100 / cols;
                      event.left = (event.left * 100) / cols;
                    }
                  }

                  return (
                    <div
                      key={dateKey}
                      className={`${styles.dayCol} ${isToday ? styles.todayCol : ""}`}
                      style={{ height: (END_HOUR - START_HOUR) * SLOT }}
                    >
                      {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                        <div key={i} className={styles.hrLine} style={{ top: i * SLOT }} />
                      ))}
                      <div className={styles.hrLine} style={{ top: (END_HOUR - START_HOUR) * SLOT }} />

                      {routineEvents.map((event) => (
                        <div
                          key={event.id}
                          className={`${styles.eventBlock} ${styles.routinePattern} ${event.compact ? styles.eventCompact : ""}`}
                          style={{
                            top: event.top,
                            height: event.height,
                            left: "2%",
                            width: "96%",
                            backgroundColor: toRgba(event.color, 0.18),
                            borderColor: toRgba(event.color, 0.4),
                          }}
                          onMouseEnter={(e) => {
                            setHoverTooltip({
                              x: Math.min(e.clientX + 14, window.innerWidth - 240),
                              y: Math.max(e.clientY - 8, 8),
                              title: event.title,
                              rows: [
                                { dot: event.color, text: event.sub },
                                { text: `${formatTooltipTime(event.startHour)} - ${formatTooltipTime(event.endHour)}` },
                                { text: "Recurring routine" },
                              ],
                            });
                          }}
                          onMouseMove={(e) => {
                            setHoverTooltip((current) =>
                              current
                                ? {
                                    ...current,
                                    x: Math.min(e.clientX + 14, window.innerWidth - 240),
                                    y: Math.max(e.clientY - 8, 8),
                                  }
                                : current,
                            );
                          }}
                          onMouseLeave={() => setHoverTooltip(null)}
                        >
                          <div className={styles.eventInner}>
                            <div className={styles.eventTitle}>{event.title}</div>
                            {!event.compact ? <div className={styles.eventSub}>{event.sub}</div> : null}
                            {!event.compact ? <div className={styles.eventTag}>Personal</div> : null}
                          </div>
                        </div>
                      ))}

                      {taskEvents.map((event) => (
                        <div
                          key={event.id}
                          className={`${styles.eventBlock} ${event.compact ? styles.eventCompact : ""}`}
                          style={{
                            top: event.top,
                            height: event.height,
                            left: `${event.left + 1}%`,
                            width: `${Math.max(event.width - 2, 20)}%`,
                            backgroundColor: `${event.color}f0`,
                          }}
                          onMouseEnter={(e) => {
                            setHoverTooltip({
                              x: Math.min(e.clientX + 14, window.innerWidth - 240),
                              y: Math.max(e.clientY - 8, 8),
                              title: event.title,
                              rows: [
                                { dot: event.color, text: event.sub },
                                { text: `${formatTooltipTime(event.startHour)} - ${formatTooltipTime(event.endHour)}` },
                                { text: "Manual block" },
                              ],
                            });
                          }}
                          onMouseMove={(e) => {
                            setHoverTooltip((current) =>
                              current
                                ? {
                                    ...current,
                                    x: Math.min(e.clientX + 14, window.innerWidth - 240),
                                    y: Math.max(e.clientY - 8, 8),
                                  }
                                : current,
                            );
                          }}
                          onMouseLeave={() => setHoverTooltip(null)}
                        >
                          <div className={styles.eventInner}>
                            <div className={styles.eventTitle}>{event.title}</div>
                            {!event.compact ? <div className={styles.eventSub}>{event.sub}</div> : null}
                            {!event.compact ? <div className={styles.eventTag}>Task</div> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.focusWrap}>
            <div className={styles.focusGrid}>
              {circles
                .filter((circle) => visibleCircleIds.includes(circle.id))
                .map((circle) => {
                  const circleTasks = visibleTasks.filter((task) => task.group_id === circle.id);
                  const doneCount = circleTasks.filter((task) => task.status === "done").length;
                  return (
                    <div key={circle.id} className={styles.focusCard}>
                      <div className={styles.focusHead}>
                        <div
                          className={styles.focusDot}
                          style={{ backgroundColor: circle.color ?? "#4f46e5" }}
                        />
                        <div className={styles.focusName}>{circle.name}</div>
                        <span style={{ fontSize: 10, color: "#6b7280" }}>
                          {doneCount}/{circleTasks.length} done
                        </span>
                      </div>

                      {circleTasks.length === 0 ? (
                        <div className={styles.focusTask} style={{ color: "#9ca3af" }}>
                          No tasks assigned this week.
                        </div>
                      ) : (
                        circleTasks.map((task) => (
                          <div key={task.id} className={styles.focusTask}>
                            <span
                              style={{
                                width: 3,
                                height: 24,
                                borderRadius: 999,
                                backgroundColor: circle.color ?? "#4f46e5",
                              }}
                            />
                            <span style={{ flex: 1 }}>{task.title}</span>
                            <span style={{ fontSize: 10, color: "#9ca3af" }}>{task.due_date ?? "No due date"}</span>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className={styles.statusBar}>
          <span>
            {circles.length} circles · {visibleTaskCount} assigned tasks this week
          </span>
          <span>
            {loading
              ? "Loading calendar..."
              : "Routines and tasks are shown in one unified weekly timeline."}
          </span>
        </div>
      </div>

      {hoverTooltip && (
        <div
          className={styles.tooltip}
          style={{
            left: `${hoverTooltip.x}px`,
            top: `${hoverTooltip.y}px`,
          }}
        >
          <div className={styles.tooltipTitle}>{hoverTooltip.title}</div>
          {hoverTooltip.rows.map((row, index) => (
            <div key={`${row.text}-${index}`} className={styles.tooltipRow}>
              {row.dot ? <span className={styles.tooltipDot} style={{ backgroundColor: row.dot }} /> : null}
              <span>{row.text}</span>
            </div>
          ))}
        </div>
      )}

      {showRoutineDialog && (
        <div className={styles.modalOverlay} onClick={() => setShowRoutineDialog(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setShowRoutineDialog(false)}
              aria-label="Close dialog"
            >
              ×
            </button>

            <div className={styles.modalHeader}>
              <div className={styles.modalBadge}>Routine Setup</div>
              <h2 className={styles.modalTitle}>Create routine</h2>
              <p className={styles.modalDesc}>
                Save recurring routines per account so they appear in your calendars across all circles.
              </p>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label htmlFor="routine-label" className={styles.modalLabel}>
                  Routine name
                </label>
                <input
                  id="routine-label"
                  type="text"
                  value={newRoutineLabel}
                  onChange={(e) => setNewRoutineLabel(e.target.value)}
                  placeholder="e.g., Morning run"
                  className={styles.modalInput}
                />
              </div>

              <div className={styles.modalGrid}>
                <div className={styles.modalField}>
                  <label htmlFor="routine-start" className={styles.modalLabel}>
                    Start time
                  </label>
                  <Select value={newRoutineStart} onValueChange={handleRoutineStartChange}>
                    <SelectTrigger id="routine-start" className={`${styles.modalInput} ${styles.modalSelectTrigger}`}>
                      <SelectValue placeholder="Select start time" />
                    </SelectTrigger>
                    <SelectContent className={styles.modalSelectContent}>
                      {routineStartTimeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className={styles.modalField}>
                  <label htmlFor="routine-end" className={styles.modalLabel}>
                    End time
                  </label>
                  <Select value={newRoutineEnd} onValueChange={setNewRoutineEnd}>
                    <SelectTrigger id="routine-end" className={`${styles.modalInput} ${styles.modalSelectTrigger}`}>
                      <SelectValue placeholder="Select end time" />
                    </SelectTrigger>
                    <SelectContent className={styles.modalSelectContent}>
                      {routineEndTimeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Days</label>
                <div className={styles.dayButtons}>
                  {WEEK_DAYS.map((day, idx) => {
                    const active = newRoutineDays.includes(idx);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setNewRoutineDays((current) =>
                            current.includes(idx)
                              ? current.filter((selectedDay) => selectedDay !== idx)
                              : [...current, idx],
                          );
                        }}
                        className={`${styles.dayBtn} ${active ? styles.dayBtnActive : ""}`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.modalField}>
                <label htmlFor="routine-color" className={styles.modalLabel}>
                  Routine color
                </label>
                <div className={styles.dashboardColorRow}>
                  <input
                    id="routine-color"
                    type="color"
                    value={newRoutineColor}
                    onChange={(e) => setNewRoutineColor(e.target.value)}
                    className={styles.dashboardColorInput}
                    aria-label="Choose routine color"
                  />
                  {ROUTINE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewRoutineColor(color)}
                      className={`${styles.dashboardColorSwatch} ${
                        newRoutineColor === color ? styles.dashboardColorSwatchActive : ""
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Pick routine color ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.modalActions}>
              <Button type="button" variant="outline" onClick={() => setShowRoutineDialog(false)} className="cursor-pointer">
                Cancel
              </Button>
              <Button type="button" onClick={() => void saveRoutine()} className="cursor-pointer">
                Save routine
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
