"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import supabase from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDesignStandard } from "@/components/ui/design-standard";
import WeekCalendarGrid, {
  type CalendarGridEvent,
} from "../../../components/calendar/WeekCalendarGrid";
import { cn } from "@/lib/utils";
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

const INPUT_START_HOUR = 0;
const INPUT_END_HOUR = 23;
const PH_TIME_ZONE = "Asia/Manila";
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROUTINE_COLORS = ["#4f46e5", "#16a34a", "#ea580c", "#9333ea", "#2563eb", "#ca8a04"];

function formatTooltipTime(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  const h = Math.floor(normalized);
  const mm = Math.round((normalized % 1) * 60);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${mm.toString().padStart(2, "0")} ${period}`;
}

function parseTimeMinutes(value: string) {
  const [hoursPart, minutesPart] = value.split(":");
  const hours = Number.parseInt(hoursPart ?? "", 10);
  const minutes = Number.parseInt(minutesPart ?? "0", 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return INPUT_START_HOUR * 60;
  }

  const totalMinutes = hours * 60 + minutes;
  const minMinutes = INPUT_START_HOUR * 60;
  const maxMinutes = INPUT_END_HOUR * 60;

  return Math.max(minMinutes, Math.min(totalMinutes, maxMinutes));
}

function toTimeInputValue(totalMinutes: number) {
  const clamped = Math.max(INPUT_START_HOUR * 60, Math.min(totalMinutes, INPUT_END_HOUR * 60));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function toDisplayRange(start: Date, end: Date) {
  const opts = { month: "short", day: "numeric" } as const;
  return `${start.toLocaleDateString("en-PH", opts)} - ${end.toLocaleDateString("en-PH", opts)}`;
}

function getPhilippineNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");

  // Use midday to avoid timezone edges when converting between locales.
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export default function MainCalendarPage() {
  const ds = useDesignStandard();
  const [loading, setLoading] = useState(true);
  const [layout] = useState<Layout>("week");
  const [density, setDensity] = useState<Density>("all");
  const [activeDate, setActiveDate] = useState(() => {
    return getPhilippineNow();
  });
  const [weekStart, setWeekStart] = useState(() => startOfWeek(activeDate));
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [visibleCircleIds, setVisibleCircleIds] = useState<string[]>([]);
  const [showRoutineDialog, setShowRoutineDialog] = useState(false);
  const [newRoutineLabel, setNewRoutineLabel] = useState("");
  const [newRoutineStart, setNewRoutineStart] = useState("09:00");
  const [newRoutineEnd, setNewRoutineEnd] = useState("10:00");
  const [newRoutineDays, setNewRoutineDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newRoutineColor, setNewRoutineColor] = useState(ROUTINE_COLORS[0]);
  const [now, setNow] = useState(() => new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const weekLabel = useMemo(() => toDisplayRange(weekDates[0], weekDates[6]), [weekDates]);


  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);


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

  const dayIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    weekDates.forEach((date, index) => {
      map.set(formatDay(date), index);
    });
    return map;
  }, [weekDates]);

  const routineEvents = useMemo<CalendarGridEvent[]>(() => {
    if (density === "tasks") {
      return [];
    }

    return routines.flatMap((routine) =>
      routine.days.map((dayIndex) => ({
        id: `${routine.id}-${dayIndex}`,
        dayIndex,
        startHour: routine.startHour,
        endHour: routine.endHour,
        title: routine.label,
        subtitle: routine.sub,
        color: routine.color,
        tag: "Personal",
        variant: "pattern",
        tooltip: {
          title: routine.label,
          rows: [
            { dot: routine.color, text: routine.sub },
            { text: `${formatTooltipTime(routine.startHour)} - ${formatTooltipTime(routine.endHour)}` },
            { text: "Recurring routine" },
          ],
        },
      })),
    );
  }, [density, routines]);

  const taskEvents = useMemo<CalendarGridEvent[]>(() => {
    if (density === "routines") {
      return [];
    }

    const grouped = new Map<number, TaskRow[]>();

    for (const task of visibleTasks) {
      if (!task.due_date) {
        continue;
      }

      const dayIndex = dayIndexByKey.get(task.due_date);
      if (dayIndex === undefined) {
        continue;
      }

      const list = grouped.get(dayIndex) ?? [];
      list.push(task);
      grouped.set(dayIndex, list);
    }

    const events: CalendarGridEvent[] = [];

    grouped.forEach((dayTasks, dayIndex) => {
      dayTasks.forEach((task, index) => {
        const circle = circleMap.get(task.group_id);
        const color = circle?.color ?? "#4f46e5";
        const sub = `${circle?.name ?? "Circle"} · ${task.status}`;
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

        events.push({
          id: task.id,
          dayIndex,
          startHour,
          endHour,
          title: task.title,
          subtitle: sub,
          color,
          tag: "Task",
          variant: "solid",
          tooltip: {
            title: task.title,
            rows: [
              { dot: color, text: sub },
              { text: `${formatTooltipTime(startHour)} - ${formatTooltipTime(endHour)}` },
              { text: "Manual block" },
            ],
          },
        });
      });
    });

    return events;
  }, [circleMap, dayIndexByKey, density, visibleTasks]);

  function syncCalendarDate(nextDate: Date) {
    const normalized = new Date(nextDate);
    normalized.setHours(12, 0, 0, 0);
    setActiveDate(normalized);
    setWeekStart(startOfWeek(normalized));
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

    const startMinutes = parseTimeMinutes(newRoutineStart);
    const endMinutes = parseTimeMinutes(newRoutineEnd);
    const startHour = startMinutes / 60;
    const endHour = endMinutes / 60;

    if (endHour <= startHour) {
      alert("End time must be later than start time");
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
      .select("id, label, details, color, days_of_week, start_time, end_time")
      .single();

    if (error || !insertedRoutine) {
      console.error("Error saving routine:", error);
      alert("Failed to save routine");
      return;
    }

    const savedStartParts = insertedRoutine.start_time.split(":").map(Number);
    const savedEndParts = insertedRoutine.end_time.split(":").map(Number);
    const savedStartHour = (savedStartParts[0] ?? 0) + (savedStartParts[1] ?? 0) / 60;
    const savedEndHour = (savedEndParts[0] ?? 0) + (savedEndParts[1] ?? 0) / 60;

    setRoutines((current) => [
      ...current,
      {
        id: insertedRoutine.id,
        label: insertedRoutine.label,
        sub: insertedRoutine.details ?? "Personal",
        color: insertedRoutine.color ?? "#374151",
        days: insertedRoutine.days_of_week,
        startHour: savedStartHour,
        endHour: savedEndHour,
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
    const nextStartMinutes = parseTimeMinutes(nextValue);
    const currentEndMinutes = parseTimeMinutes(newRoutineEnd);

    if (currentEndMinutes <= nextStartMinutes) {
      setNewRoutineEnd(toTimeInputValue(nextStartMinutes + 60));
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.appBar}>
        <div className={styles.appId}>
          <div>
            <div className={styles.appSub}>Personal view - Week of {weekLabel}</div>
          </div>
        </div>
      </header>

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
                <PopoverContent className={cn(styles.dateJumpPopover, ds.calendar.dateJumpPopover)} align="start">
                  <Calendar
                    mode="single"
                    selected={activeDate}
                    defaultMonth={activeDate}
                    onSelect={(nextDate) => {
                      if (nextDate) {
                        syncCalendarDate(nextDate);
                        setDatePickerOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
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
                  <span className={styles.circleChipBody}>
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
          <WeekCalendarGrid
            weekDates={weekDates}
            foregroundEvents={taskEvents}
            backgroundEvents={routineEvents}
            now={now}
            tooltipClassName={ds.calendar.tooltip}
            tooltipTitleClassName={ds.calendar.tooltipTitle}
            tooltipRowClassName={ds.calendar.tooltipRow}
            tooltipDotClassName={ds.calendar.tooltipDot}
          />
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
                  <Input
                    type="time"
                    id="routine-start"
                    step={60}
                    value={newRoutineStart}
                    onChange={(event) => handleRoutineStartChange(event.target.value)}
                    className={`${styles.modalInput} ${styles.modalTimeInput}`}
                    min="00:00"
                    max="23:00"
                    required
                  />
                </div>

                <div className={styles.modalField}>
                  <label htmlFor="routine-end" className={styles.modalLabel}>
                    End time
                  </label>
                  <Input
                    id="routine-end"
                    type="time"
                    value={newRoutineEnd}
                    onChange={(event) => setNewRoutineEnd(event.target.value)}
                    className={`${styles.modalInput} ${styles.modalTimeInput}`}
                    min="00:00"
                    max="23:00"
                    step={60}
                    required
                  />
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
