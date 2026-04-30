"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FloatingTooltip, { type FloatingTooltipContent } from "@/components/calendar/FloatingTooltip";
import { cn } from "@/lib/utils";
import styles from "@/app/(app)/calendar/page.module.css";

const SLOT = 52;
const DEFAULT_START_HOUR = 5;
const DEFAULT_END_HOUR = 24;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CalendarGridEvent = {
  id: string;
  dayIndex: number;
  startHour: number;
  endHour: number;
  title: string;
  subtitle?: string;
  tag?: string;
  color: string;
  variant?: "solid" | "pattern" | "window";
  tooltip?: FloatingTooltipContent;
  onClick?: () => void;
};

export type CalendarGridBadge = {
  id: string;
  dayIndex: number;
  label: string;
  color?: string;
  tooltip?: FloatingTooltipContent;
  onClick?: () => void;
};

type WeekCalendarGridProps = {
  weekDates: Date[];
  foregroundEvents: CalendarGridEvent[];
  backgroundEvents?: CalendarGridEvent[];
  badges?: CalendarGridBadge[];
  now?: Date;
  startHour?: number;
  endHour?: number;
  tooltipClassName?: string;
  tooltipTitleClassName?: string;
  tooltipRowClassName?: string;
  tooltipDotClassName?: string;
};

type LayoutEvent = CalendarGridEvent & {
  top: number;
  height: number;
  left: number;
  width: number;
  compact: boolean;
};

function formatHourLabel(hour: number) {
  const whole = Math.floor(hour);
  const normalized = ((whole % 24) + 24) % 24;
  const period = normalized >= 12 ? "PM" : "AM";
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display} ${period}`;
}

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

function clampRange(start: number, end: number, min: number, max: number) {
  const clampedStart = Math.max(start, min);
  const clampedEnd = Math.min(end, max);
  if (clampedEnd <= clampedStart) {
    return null;
  }
  return { start: clampedStart, end: clampedEnd };
}

function groupEventsByDay(
  events: CalendarGridEvent[] | undefined,
  startHour: number,
  endHour: number,
) {
  const map = new Map<number, CalendarGridEvent[]>();

  for (const event of events ?? []) {
    if (event.dayIndex < 0 || event.dayIndex > 6) {
      continue;
    }

    const range = clampRange(event.startHour, event.endHour, startHour, endHour);
    if (!range) {
      continue;
    }

    const list = map.get(event.dayIndex) ?? [];
    list.push({ ...event, startHour: range.start, endHour: range.end });
    map.set(event.dayIndex, list);
  }

  return map;
}

function groupBadgesByDay(badges: CalendarGridBadge[] | undefined) {
  const map = new Map<number, CalendarGridBadge[]>();

  for (const badge of badges ?? []) {
    if (badge.dayIndex < 0 || badge.dayIndex > 6) {
      continue;
    }

    const list = map.get(badge.dayIndex) ?? [];
    list.push(badge);
    map.set(badge.dayIndex, list);
  }

  return map;
}

function layoutEvents(events: CalendarGridEvent[], startHour: number) {
  if (!events.length) {
    return [] as LayoutEvent[];
  }

  const sorted = [...events].sort((left, right) =>
    left.startHour !== right.startHour
      ? left.startHour - right.startHour
      : right.endHour - left.endHour,
  );

  const positioned: LayoutEvent[] = sorted.map((event) => ({
    ...event,
    top: (event.startHour - startHour) * SLOT,
    height: Math.max((event.endHour - event.startHour) * SLOT, 36),
    left: 0,
    width: 100,
    compact: event.endHour - event.startHour <= 0.85,
  }));

  const slotEnds: number[] = [];

  positioned.forEach((event) => {
    let slot = -1;
    for (let idx = 0; idx < slotEnds.length; idx += 1) {
      if (slotEnds[idx] <= event.startHour + 0.01) {
        slot = idx;
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

  positioned.forEach((event) => {
    let maxSlot = event.left;
    positioned.forEach((other) => {
      const overlap = other.startHour < event.endHour && other.endHour > event.startHour;
      if (overlap) {
        maxSlot = Math.max(maxSlot, other.left);
      }
    });

    const cols = maxSlot + 1;
    event.width = 100 / cols;
    event.left = (event.left * 100) / cols;
  });

  return positioned;
}

function getTooltipPoint(clientX: number, clientY: number) {
  return {
    x: Math.min(clientX + 14, window.innerWidth - 240),
    y: Math.max(clientY - 8, 8),
  };
}

export default function WeekCalendarGrid({
  weekDates,
  foregroundEvents,
  backgroundEvents = [],
  badges = [],
  now,
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  tooltipClassName,
  tooltipTitleClassName,
  tooltipRowClassName,
  tooltipDotClassName,
}: WeekCalendarGridProps) {
  const [hoverTooltip, setHoverTooltip] = useState<FloatingTooltipContent | null>(null);
  const tooltipElementRef = useRef<HTMLDivElement | null>(null);
  const tooltipRafRef = useRef<number | null>(null);
  const tooltipPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const tooltipVisibleRef = useRef(false);

  const hours = Math.max(0, endHour - startHour);
  const todayKey = now ? now.toDateString() : "";
  const nowHour = now ? now.getHours() + now.getMinutes() / 60 : null;
  const nowVisible = nowHour !== null && nowHour >= startHour && nowHour < endHour;
  const nowTop = nowHour === null ? 0 : Math.max(0, Math.min((nowHour - startHour) * SLOT, hours * SLOT));

  const backgroundByDay = useMemo(
    () => groupEventsByDay(backgroundEvents, startHour, endHour),
    [backgroundEvents, endHour, startHour],
  );

  const foregroundByDay = useMemo(
    () => groupEventsByDay(foregroundEvents, startHour, endHour),
    [endHour, foregroundEvents, startHour],
  );

  const badgesByDay = useMemo(() => groupBadgesByDay(badges), [badges]);

  useEffect(() => {
    return () => {
      if (tooltipRafRef.current) {
        cancelAnimationFrame(tooltipRafRef.current);
      }
    };
  }, []);

  function applyTooltipPosition(point: { x: number; y: number }) {
    const element = tooltipElementRef.current;
    if (!element) {
      return;
    }

    element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
  }

  function openTooltip(event: { clientX: number; clientY: number }, tooltip: FloatingTooltipContent) {
    const point = getTooltipPoint(event.clientX, event.clientY);
    tooltipPointRef.current = point;
    tooltipVisibleRef.current = true;
    setHoverTooltip(tooltip);
    window.requestAnimationFrame(() => {
      applyTooltipPosition(point);
    });
  }

  function trackTooltip(event: { clientX: number; clientY: number }) {
    if (!tooltipVisibleRef.current) {
      return;
    }

    tooltipPointRef.current = getTooltipPoint(event.clientX, event.clientY);

    if (tooltipRafRef.current) {
      return;
    }

    tooltipRafRef.current = window.requestAnimationFrame(() => {
      tooltipRafRef.current = null;
      applyTooltipPosition(tooltipPointRef.current);
    });
  }

  function closeTooltip() {
    tooltipVisibleRef.current = false;
    if (tooltipRafRef.current) {
      cancelAnimationFrame(tooltipRafRef.current);
      tooltipRafRef.current = null;
    }
    setHoverTooltip(null);
  }

  return (
    <div>
      <div className={styles.scroll}>
        <div className={styles.weekHead}>
          <div className={styles.weekHeadSpacer} />
          {weekDates.map((date, index) => {
            const isToday = date.toDateString() === todayKey;
            return (
              <div key={date.toISOString()} className={styles.dayHeader}>
                <div className={styles.dayName}>{DAY_LABELS[index] ?? DAY_LABELS[date.getDay()]}</div>
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
            {Array.from({ length: hours }, (_, index) => {
              const hour = startHour + index;
              return (
                <div key={hour} className={styles.timeCell}>
                  <span>{formatHourLabel(hour)}</span>
                </div>
              );
            })}
          </div>

          {weekDates.map((date, dayIndex) => {
            const isToday = date.toDateString() === todayKey;
            const dayBackground = backgroundByDay.get(dayIndex) ?? [];
            const dayForeground = layoutEvents(foregroundByDay.get(dayIndex) ?? [], startHour);
            const dayBadges = badgesByDay.get(dayIndex) ?? [];

            return (
              <div
                key={`${date.toISOString()}-day`}
                className={cn(styles.dayCol, isToday && styles.todayCol)}
                style={{ height: hours * SLOT }}
              >
                {Array.from({ length: hours + 1 }, (_, index) => (
                  <div key={index} className={styles.hrLine} style={{ top: index * SLOT }} />
                ))}

                {isToday && nowVisible ? (
                  <div className={styles.nowIndicator} style={{ top: nowTop }} aria-hidden="true">
                    <span className={styles.nowDot} />
                    <span className={styles.nowLine} />
                  </div>
                ) : null}

                {dayBackground.map((event) => {
                  const isPattern = event.variant === "pattern";
                  const isWindow = event.variant === "window";
                  const tooltip = event.tooltip;
                  const backgroundColor = isPattern
                    ? toRgba(event.color, 0.18)
                    : isWindow
                      ? toRgba(event.color, 0.12)
                      : toRgba(event.color, 0.94);
                  const borderColor = isPattern
                    ? toRgba(event.color, 0.4)
                    : isWindow
                      ? toRgba(event.color, 0.35)
                      : event.color;

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        styles.eventBlock,
                        isPattern && styles.routinePattern,
                        isWindow && styles.windowBlock,
                        event.endHour - event.startHour <= 0.85 && styles.eventCompact,
                      )}
                      style={{
                        top: (event.startHour - startHour) * SLOT,
                        height: (event.endHour - event.startHour) * SLOT,
                        left: "2%",
                        width: "96%",
                        backgroundColor,
                        borderColor,
                      }}
                      onClick={event.onClick}
                      onMouseEnter={
                        tooltip ? (mouseEvent) => openTooltip(mouseEvent, tooltip) : undefined
                      }
                      onMouseMove={tooltip ? trackTooltip : undefined}
                      onMouseLeave={tooltip ? closeTooltip : undefined}
                    >
                      <div className={styles.eventInner}>
                        <div className={styles.eventTitle}>{event.title}</div>
                        {event.endHour - event.startHour > 0.85 && event.subtitle ? (
                          <div className={styles.eventSub}>{event.subtitle}</div>
                        ) : null}
                        {event.endHour - event.startHour > 0.85 && event.tag ? (
                          <div className={styles.eventTag}>{event.tag}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {dayForeground.map((event) => {
                  const isPattern = event.variant === "pattern";
                  const isWindow = event.variant === "window";
                  const tooltip = event.tooltip;
                  const backgroundColor = isPattern
                    ? toRgba(event.color, 0.18)
                    : isWindow
                      ? toRgba(event.color, 0.12)
                      : toRgba(event.color, 0.94);
                  const borderColor = isPattern
                    ? toRgba(event.color, 0.4)
                    : isWindow
                      ? toRgba(event.color, 0.35)
                      : event.color;

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        styles.eventBlock,
                        isPattern && styles.routinePattern,
                        isWindow && styles.windowBlock,
                        event.compact && styles.eventCompact,
                      )}
                      style={{
                        top: event.top,
                        height: event.height,
                        left: `${event.left + 1}%`,
                        width: `${Math.max(event.width - 2, 20)}%`,
                        backgroundColor,
                        borderColor,
                      }}
                      onClick={event.onClick}
                      onMouseEnter={
                        tooltip ? (mouseEvent) => openTooltip(mouseEvent, tooltip) : undefined
                      }
                      onMouseMove={tooltip ? trackTooltip : undefined}
                      onMouseLeave={tooltip ? closeTooltip : undefined}
                    >
                      <div className={styles.eventInner}>
                        <div className={styles.eventTitle}>{event.title}</div>
                        {!event.compact && event.subtitle ? (
                          <div className={styles.eventSub}>{event.subtitle}</div>
                        ) : null}
                        {!event.compact && event.tag ? (
                          <div className={styles.eventTag}>{event.tag}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {dayBadges.map((badge) => {
                  const tooltip = badge.tooltip;
                  return (
                  <button
                    key={badge.id}
                    type="button"
                    className={styles.deadlineBadge}
                    style={badge.color ? { backgroundColor: badge.color } : undefined}
                    onClick={badge.onClick}
                    onMouseEnter={tooltip ? (mouseEvent) => openTooltip(mouseEvent, tooltip) : undefined}
                    onMouseMove={tooltip ? trackTooltip : undefined}
                    onMouseLeave={tooltip ? closeTooltip : undefined}
                  >
                    {badge.label}
                  </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <FloatingTooltip
        ref={tooltipElementRef}
        tooltip={hoverTooltip}
        className={cn(styles.tooltip, tooltipClassName)}
        titleClassName={cn(styles.tooltipTitle, tooltipTitleClassName)}
        rowClassName={cn(styles.tooltipRow, tooltipRowClassName)}
        dotClassName={cn(styles.tooltipDot, tooltipDotClassName)}
      />
    </div>
  );
}
