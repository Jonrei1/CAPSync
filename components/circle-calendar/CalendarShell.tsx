"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AddMeetingDialog from "@/components/circle-calendar/AddMeetingDialog";
import { designTokens } from "@/components/ui/design-standard";
import { toast } from "@/components/ui/use-toast";
import supabase from "@/lib/supabaseClient";
import type { CalendarBlock, CalendarDeadline, CalendarMember, FreeWindow } from "@/types";

type CalendarShellProps = {
  members: CalendarMember[];
  blocks: CalendarBlock[];
  freeWindows: FreeWindow[];
  deadlines: CalendarDeadline[];
  groupId: string;
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

const SH = 6;
const EH = 21;
const SLOT = 52;
const WDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WKEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WORKD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WORKK = ["mon", "tue", "wed", "thu", "fri", "sat"];
const HCOLS = ["#f0fdf4", "#dbeafe", "#93c5fd", "#3b82f6", "#1e3a8a"];
const HBDS = ["#86efac", "#bfdbfe", "#60a5fa", "#1d4ed8", "#172554"];
const HTXT = ["#15803d", "#1e40af", "#1e40af", "#fff", "#fff"];

const CALENDAR_STYLES = `
:root{
  --bg:#fff;--bg2:#f9fafb;--bg3:#f3f4f6;
  --border:#e5e7eb;--border2:#d1d5db;
  --text:#111827;--muted:#6b7280;--muted2:#9ca3af;
  --primary:${designTokens.palette.app.brandPrimary};--primary-l:#eef2ff;
  --green:${designTokens.palette.app.brandAccent};--green-l:#f0fdf4;--green-b:#86efac;
  --red:${designTokens.palette.app.status.danger};
  --shadow:0 1px 3px rgba(0,0,0,.08);
  --shadow-lg:0 8px 24px rgba(0,0,0,.12);
  --r:${designTokens.radiusValue.xs};--r-lg:10px;
}
.cc-root,.cc-root *{box-sizing:border-box}
.cc-root{font-family:var(--font-inter),system-ui,sans-serif;color:var(--text);display:flex;flex-direction:column;gap:14px}
.app-bar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.app-id{display:flex;align-items:center;gap:10px}
.logo{width:36px;height:36px;background:var(--primary);border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px}
.app-name{font-size:17px;font-weight:700}
.app-sub{font-size:11px;color:var(--muted);margin-top:1px}
.ltabs{display:flex;background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:3px;gap:2px;box-shadow:var(--shadow)}
.lt{display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 13px;border-radius:5px;border:none;background:transparent;cursor:pointer;transition:all .15s;min-width:80px;font-family:inherit}
.lt:hover{background:var(--bg3)}
.lt.on{background:var(--primary)}
.lt-ico{font-size:14px;line-height:1}
.lt-name{font-size:11px;font-weight:500;color:var(--muted)}
.lt-hint{font-size:9px;color:var(--muted2)}
.lt.on .lt-name{color:#fff}
.lt.on .lt-hint{color:rgba(255,255,255,.55)}
.card{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow);overflow:hidden}
.tb{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px}
.tb-l,.tb-r{display:flex;align-items:center;gap:7px}
.wk-title{font-size:14px;font-weight:600}
.btn{height:30px;padding:0 11px;border-radius:var(--r);font-size:12px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:5px;border:1px solid transparent;font-family:inherit;transition:all .15s}
.btn-ghost{background:transparent;border-color:transparent;color:var(--muted)}
.btn-ghost:hover{background:var(--bg2);color:var(--text)}
.btn-outline{background:transparent;border-color:var(--border2);color:var(--text)}
.btn-outline:hover{background:var(--bg2)}
.btn-primary{background:var(--primary);color:#fff}
.btn-primary:hover{background:#4338ca}
.btn-green{background:var(--green);color:#fff}
.btn-green:hover{background:#15803d}
.btn-icon{width:30px;padding:0;justify-content:center}
.fp{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);background:var(--bg2);flex-wrap:wrap}
.fp-lbl{font-size:10px;font-weight:600;color:var(--muted2);text-transform:uppercase;letter-spacing:.06em;flex-shrink:0;margin-right:2px}
.fp-chips{display:flex;gap:6px;flex-wrap:wrap;flex:1}
.m-chip{display:flex;align-items:center;gap:6px;padding:5px 11px;border-radius:8px;border:1.5px solid;cursor:pointer;transition:all .18s;background:var(--bg);user-select:none;position:relative}
.m-chip:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,.08)}
.m-chip.off{background:var(--bg3);opacity:.5;border-color:var(--border2)!important}
.m-chip.off .m-chip-name{color:var(--muted2)!important}
.m-av{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0}
.m-chip-info{display:flex;flex-direction:column;gap:0}
.m-chip-name{font-size:12px;font-weight:600;line-height:1.3}
.m-chip-role{font-size:9px;color:var(--muted2);line-height:1.3}
.m-chip-check{width:15px;height:15px;border-radius:50%;border:1.5px solid;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:1px;transition:all .18s}
.m-chip:not(.off) .m-chip-check{background:var(--green);border-color:var(--green)}
.m-chip.off .m-chip-check{background:transparent;border-color:var(--border2)}
.fp-right{display:flex;align-items:center;gap:7px;margin-left:auto;flex-shrink:0}
.fp-info{font-size:11px;color:var(--muted)}
.suggest-btn{height:30px;padding:0 14px;border-radius:9999px;border:none;background:var(--green);color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;transition:background .15s;white-space:nowrap}
.suggest-btn:hover{background:#15803d}
.view{display:none}.view.on{display:block}
.wk-head{display:grid;grid-template-columns:52px repeat(7,1fr);border-bottom:1px solid var(--border);background:var(--bg);position:sticky;top:0;z-index:10}
.wk-head-spacer{height:48px;border-right:1px solid var(--border)}
.wk-day-cell{padding:7px 4px;text-align:center;border-left:1px solid var(--border)}
.wk-dname{font-size:10px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.wk-dnum{font-size:18px;font-weight:700;color:var(--text);line-height:1.2;margin-top:2px}
.wk-dnum-today{width:30px;height:30px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;margin:2px auto 0;font-size:16px;font-weight:700}
.wk-scroll{overflow-y:auto;max-height:520px;position:relative}
.wk-grid{display:grid;grid-template-columns:52px repeat(7,1fr);min-height:calc((21 - 6) * 52px)}
.time-col{border-right:1px solid var(--border)}
.time-cell{height:52px;display:flex;align-items:flex-start;justify-content:flex-end;padding:0 8px;position:relative;top:-7px}
.time-cell span{font-size:10px;color:var(--muted2);white-space:nowrap}
.time-half{height:26px}
.day-col{position:relative;border-left:1px solid var(--border)}
.day-col.today-col{background:rgba(79,70,229,.018)}
.hr-line{position:absolute;left:0;right:0;border-top:1px solid var(--border)}
.hf-line{position:absolute;left:0;right:0;border-top:1px dashed var(--border);opacity:.45}
.ev{position:absolute;border-radius:5px;overflow:hidden;cursor:pointer;transition:box-shadow .15s, filter .15s;z-index:3}
.ev:hover{filter:brightness(.9);box-shadow:0 4px 16px rgba(0,0,0,.22);z-index:20}
.ev-inner{height:100%;padding:4px 6px;border-left:3px solid rgba(0,0,0,.15);display:flex;flex-direction:column;gap:1px;overflow:hidden}
.ev-routine .ev-inner{background-image:repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,.22) 3px,rgba(255,255,255,.22) 6px)}
.ev-title{font-size:10px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ev-sub{font-size:9px;opacity:.82;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.ev-pills{display:flex;align-items:center;gap:3px;margin-top:2px;flex-wrap:nowrap}
.ev-pill{font-size:8px;padding:1px 6px;border-radius:9999px;font-weight:600;white-space:nowrap;flex-shrink:0;width:fit-content;align-self:flex-start}
.ev.compact .ev-title{font-size:9px}
.ev.narrow{border-radius:5px}
.ev.narrow .ev-inner{padding:0;border-left:3px solid rgba(0,0,0,.18);display:flex;flex-direction:row;align-items:stretch;overflow:hidden;gap:0}
.ev.narrow .ev-title,.ev.narrow .ev-sub,.ev.narrow .ev-npill{writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);white-space:nowrap;overflow:hidden;text-overflow:clip;flex-shrink:0;display:flex;align-items:center}
.ev.narrow .ev-title{font-size:9px;font-weight:700;line-height:1;letter-spacing:.02em;padding:5px 1px 5px 3px;width:14px}
.ev.narrow .ev-vdiv{width:1px;flex-shrink:0;background:rgba(255,255,255,.22);align-self:stretch}
.ev.narrow .ev-sub{font-size:8px;font-weight:500;opacity:.8;padding:5px 0;width:12px}
.ev.narrow .ev-npill{font-size:7px;font-weight:700;padding:5px 2px;border-radius:9999px;margin:4px 2px 4px 1px;width:auto;align-self:center}
.ev.narrow .ev-pills{display:none}
.ev.narrow.short-block .ev-vdiv,.ev.narrow.short-block .ev-sub,.ev.narrow.short-block .ev-npill{display:none!important}
.free-ov{position:absolute;left:3px;right:3px;border-radius:5px;border:1px solid var(--green-b);background:var(--green-l);cursor:pointer;overflow:hidden;z-index:1;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:4px 6px}
.free-ov:hover{background:#dcfce7;border-color:var(--green)}
.free-ov-lbl{font-size:9px;font-weight:700;color:var(--green)}
.free-ov-sub{font-size:8px;color:#4ade80}
.free-pips{display:flex;gap:2px}
.free-pip{width:5px;height:5px;border-radius:50%}
.dl-chip{position:absolute;top:2px;right:3px;font-size:8px;font-weight:700;padding:1px 6px;border-radius:9999px;background:var(--red);color:#fff;z-index:8;cursor:pointer;white-space:nowrap;box-shadow:0 1px 4px rgba(220,38,38,.35)}
.now-line{position:absolute;left:0;right:0;z-index:15;pointer-events:none;display:flex;align-items:center}
.now-dot{width:8px;height:8px;border-radius:50%;background:var(--red);flex-shrink:0;margin-left:-4px}
.now-bar{flex:1;height:1.5px;background:var(--red)}
.heat-wrap{padding:16px 20px}
.heat-caption{font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.5}
.heat-scroll{overflow-x:auto}
.heat-grid{display:grid;min-width:600px}
.h-corner{font-size:9px;color:var(--muted2);display:flex;align-items:flex-end;padding-bottom:4px;padding-right:6px}
.h-dhead{text-align:center;font-size:10px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;padding-bottom:4px}
.h-time{font-size:9px;color:var(--muted2);display:flex;align-items:center;justify-content:flex-end;padding-right:7px;white-space:nowrap}
.h-cell{height:22px;border-radius:3px;margin:1.5px;cursor:pointer;transition:all .12s;display:flex;align-items:center;justify-content:center}
.h-cell:hover{transform:scale(1.08);z-index:2}
.h-cval{font-size:8px;font-weight:700}
.h-leg{display:flex;align-items:center;gap:12px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);flex-wrap:wrap}
.hl{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--muted)}
.hl-sw{width:18px;height:11px;border-radius:2px}
.f-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.f-badge{font-size:11px;font-weight:500;padding:5px 12px;border-radius:9999px;background:var(--green-l);border:1px solid var(--green-b);color:var(--green);cursor:pointer;transition:all .15s}
.f-badge:hover{background:var(--green);color:#fff}
.dots-wrap{padding:16px 20px}
.dots-scroll{overflow-x:auto}
.dots-inner{min-width:680px}
.d-th-row{display:flex;margin-left:96px;margin-bottom:5px}
.d-th{flex:1;text-align:center;font-size:8px;color:var(--muted2)}
.d-section{margin-bottom:16px}
.d-day-lbl{font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:8px;margin-bottom:5px}
.d-div{flex:1;height:1px;background:var(--border)}
.d-mrow{display:flex;align-items:center;margin-bottom:3px}
.d-mlabel{display:flex;align-items:center;gap:5px;width:96px;flex-shrink:0}
.d-av{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff}
.d-mname{font-size:10px;font-weight:500;color:var(--text)}
.d-track{display:flex;flex:1;gap:2px}
.d-cell{flex:1;height:20px;border-radius:3px;cursor:pointer;transition:all .12s;display:flex;align-items:center;justify-content:center}
.d-cell:hover{transform:scaleY(1.15);z-index:2}
.d-free{background:var(--green-l);border:1px solid var(--green-b)}
.d-pip{width:4px;height:4px;border-radius:50%;background:var(--green)}
.d-fw-row{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;margin-left:96px}
.d-fw-b{font-size:9px;font-weight:500;padding:2px 8px;border-radius:9999px;background:var(--green-l);border:1px solid var(--green-b);color:var(--green);cursor:pointer;transition:all .15s}
.d-fw-b:hover{background:var(--green);color:#fff}
.fwo-wrap{padding:14px 18px;display:flex;flex-direction:column;gap:8px}
.fwo-caption{font-size:12px;color:var(--muted);margin-bottom:4px;line-height:1.5}
.fwo-group{border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:8px}
.fwo-head{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;background:var(--bg2);border-bottom:1px solid var(--border)}
.fwo-dname{font-size:13px;font-weight:600}
.fwo-today{font-size:9px;font-weight:600;padding:1px 7px;border-radius:9999px;background:var(--primary-l);color:var(--primary);margin-left:6px}
.fwo-cnt{font-size:10px;font-weight:500;padding:2px 8px;border-radius:9999px}
.fwo-none{padding:12px 14px;font-size:12px;color:var(--muted2);font-style:italic}
.fwo-row{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s}
.fwo-row:last-child{border-bottom:none}
.fwo-row:hover{background:var(--bg2)}
.fwo-tc{background:var(--green-l);border:1px solid var(--green-b);border-radius:var(--r);padding:8px 12px;text-align:center;flex-shrink:0;min-width:98px}
.fwo-start{font-size:15px;font-weight:700;color:var(--green);line-height:1.2}
.fwo-end{font-size:10px;color:#4ade80;line-height:1.2}
.fwo-dur{font-size:10px;font-weight:600;color:var(--green);margin-top:3px}
.fwo-info{flex:1;display:flex;flex-direction:column;gap:3px}
.fwo-mems{display:flex;gap:7px;flex-wrap:wrap}
.fwo-m{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)}
.fwo-mdot{width:9px;height:9px;border-radius:50%}
.fwo-absent{font-size:10px;color:var(--muted2);font-style:italic}
.fwo-ok{font-size:10px;color:var(--green);font-weight:500}
.fwo-acts{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.sbar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-top:1px solid var(--border);background:var(--bg2);flex-wrap:wrap;gap:6px}
.leg-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.leg{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted)}
.lsw{width:11px;height:11px;border-radius:2px}
.lsw-r{background:repeating-linear-gradient(45deg,#c7d2fe,#c7d2fe 2px,#818cf8 2px,#818cf8 4px)}
.lsw-m{background:var(--primary)}
.lsw-f{background:var(--green-l);border:1.5px dashed var(--green-b)}
#tip{position:fixed;z-index:9999;background:var(--bg);border:1px solid var(--border2);border-radius:var(--r);padding:10px 13px;font-size:11px;color:var(--text);box-shadow:var(--shadow-lg);pointer-events:none;display:none;max-width:230px;line-height:1.5}
.tt-title{font-size:13px;font-weight:600;margin-bottom:5px}
.tt-r{display:flex;align-items:center;gap:6px;color:var(--muted);margin-bottom:3px}
.tt-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.tt-divider{height:1px;background:var(--border);margin:6px 0}
.tt-small{font-size:10px;color:var(--muted2)}
`;

function fmt(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h % 1) * 60);
  const p = hh >= 12 ? "PM" : "AM";
  const d = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
  return `${d}:${mm.toString().padStart(2, "0")} ${p}`;
}

function hPx(h: number) {
  return (h - SH) * SLOT;
}

function dPx(s: number, e: number) {
  return (e - s) * SLOT;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getWeekDates(offset = 0) {
  const current = new Date();
  current.setDate(current.getDate() + offset * 7);
  const dow = current.getDay();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(current);
    date.setDate(current.getDate() - dow + index);
    return date;
  });
}

function hexToRgba(hex: string, alpha: number) {
  const cleaned = hex.trim().replace("#", "");
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

function darkenHex(hex: string) {
  const cleaned = hex.trim().replace("#", "");
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

function getDayKey(date: Date) {
  return WKEYS[date.getDay()];
}

function getDayLabel(day: string) {
  const index = WKEYS.indexOf(day as (typeof WKEYS)[number]);
  return index >= 0 ? WDAYS[index] : day;
}

function isSameSubset(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function tipMarkup(title: string, rows: TipRow[]) {
  const body = rows
    .map((row) => `<div class="tt-r">${row.dot ? `<div class="tt-dot" style="background:${row.dot}"></div>` : ""}${row.txt}</div>`)
    .join("");
  return `<div class="tt-title">${title}</div>${body}`;
}

export default function CalendarShell({ members, blocks, freeWindows, deadlines, groupId }: CalendarShellProps) {
  const router = useRouter();
  const [wkOff, setWkOff] = useState(0);
  const [vis, setVis] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(members.map((member) => [member.id, true])),
  );
  const [layout, setLayout] = useState<Layout>("week");
  const [addMeetingOpen, setAddMeetingOpen] = useState(false);
  const [meetingPrefill, setMeetingPrefill] = useState<MeetingPrefill>({});
  const [nowTick, setNowTick] = useState(() => new Date());
  const tipRef = useRef<HTMLDivElement | null>(null);
  const weekHeadersRef = useRef<HTMLDivElement | null>(null);
  const weekGridRef = useRef<HTMLDivElement | null>(null);
  const heatGridRef = useRef<HTMLDivElement | null>(null);
  const dotsRef = useRef<HTMLDivElement | null>(null);
  const freeListRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const initialScrollDone = useRef(false);

  const weekDates = useMemo(() => getWeekDates(wkOff), [wkOff]);
  const weekLabel = useMemo(
    () => `${weekDates[0].toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`,
    [weekDates],
  );
  const visibleCount = useMemo(() => Object.values(vis).filter(Boolean).length, [vis]);
  const sharedFreeWindowCount = useMemo(
    () => freeWindows.filter((window) => window.memberIds.filter((memberId) => vis[memberId]).length >= visibleCount).length,
    [freeWindows, vis, visibleCount],
  );

  useEffect(() => {
    setVis((current) => {
      const next: Record<string, boolean> = {};
      members.forEach((member) => {
        next[member.id] = current[member.id] ?? true;
      });
      return next;
    });
  }, [members]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTick(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
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

  useEffect(() => {
    if (layout === "week" && !initialScrollDone.current) {
      const scrollNode = scrollRef.current;
      if (scrollNode) {
        scrollNode.scrollTop = hPx(7) - 16;
        initialScrollDone.current = true;
      }
    }
  }, [layout, weekDates]);

  function getMem(id: string) {
    return members.find((member) => member.id === id) ?? null;
  }

  function visCnt() {
    return Object.values(vis).filter(Boolean).length;
  }

  function isBusy(memberId: string, day: string, hour: number) {
    return blocks.some((block) => block.memberId === memberId && block.days.includes(day) && hour >= block.s && hour < block.e);
  }

  function busyCnt(day: string, hour: number) {
    return members.filter((member) => vis[member.id] && isBusy(member.id, day, hour)).length;
  }

  function showTip(event: { clientX: number; clientY: number }, title: string, rows: TipRow[]) {
    const tip = tipRef.current;
    if (!tip) {
      return;
    }

    tip.innerHTML = tipMarkup(title, rows);
    tip.style.display = "block";
    tip.style.left = `${Math.min(event.clientX + 14, window.innerWidth - 240)}px`;
    tip.style.top = `${Math.max(event.clientY - 8, 8)}px`;
  }

  function hideTip() {
    if (tipRef.current) {
      tipRef.current.style.display = "none";
    }
  }

  function layoutEvents(events: Array<CalendarBlock & { mem: CalendarMember }>) {
    if (!events.length) {
      return [] as Array<CalendarBlock & { mem: CalendarMember; _slot?: number; _cols?: number }>;
    }

    const sorted = [...events].sort((a, b) => (a.s !== b.s ? a.s - b.s : b.e - a.e)) as Array<
      CalendarBlock & { mem: CalendarMember; _slot?: number; _cols?: number }
    >;

    const slots: number[] = [];
    sorted.forEach((event) => {
      let placed = false;
      for (let index = 0; index < slots.length; index += 1) {
        if (slots[index] <= event.s + 0.01) {
          event._slot = index;
          slots[index] = event.e;
          placed = true;
          break;
        }
      }
      if (!placed) {
        event._slot = slots.length;
        slots.push(event.e);
      }
    });

    sorted.forEach((event) => {
      let maxSlot = event._slot ?? 0;
      sorted.forEach((other) => {
        if (other !== event && other.s < event.e - 0.01 && other.e > event.s + 0.01) {
          maxSlot = Math.max(maxSlot, other._slot ?? 0);
        }
      });
      event._cols = maxSlot + 1;
    });

    return sorted;
  }

  function openAddMeeting(day: string, start: number, end: number) {
    setMeetingPrefill({ day, start, end });
    setAddMeetingOpen(true);
  }

  function showAll() {
    setVis(Object.fromEntries(members.map((member) => [member.id, true])));
  }

  function doSuggest() {
    toast({ title: "AI meeting suggester coming soon" });
  }

  function toggleMember(memberId: string) {
    setVis((current) => ({ ...current, [memberId]: !current[memberId] }));
  }

  useEffect(() => {
    const tip = tipRef.current;
    if (tip) {
      tip.style.display = "none";
    }

    if (!weekHeadersRef.current || !weekGridRef.current || !heatGridRef.current || !dotsRef.current || !freeListRef.current) {
      return;
    }

    const dates = weekDates;
    const today = new Date();
    const nowH = nowTick.getHours() + nowTick.getMinutes() / 60;

    weekHeadersRef.current.innerHTML = "";
    dates.forEach((date, index) => {
      const isToday = date.toDateString() === today.toDateString();
      const cell = document.createElement("div");
      cell.className = "wk-day-cell";

      const name = document.createElement("div");
      name.className = "wk-dname";
      if (isToday) {
        name.style.color = "var(--primary)";
      }
      name.textContent = WDAYS[index];

      const wrapper = document.createElement("div");
      wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;margin-top:1px";

      if (isToday) {
        const todayNum = document.createElement("div");
        todayNum.className = "wk-dnum-today";
        todayNum.textContent = String(date.getDate());
        wrapper.appendChild(todayNum);
      } else {
        const normalNum = document.createElement("div");
        normalNum.className = "wk-dnum";
        normalNum.textContent = String(date.getDate());
        wrapper.appendChild(normalNum);
      }

      cell.appendChild(name);
      cell.appendChild(wrapper);
      weekHeadersRef.current?.appendChild(cell);
    });

    weekGridRef.current.innerHTML = "";

    const gutter = document.createElement("div");
    gutter.className = "time-col";
    for (let hour = SH; hour <= EH; hour += 1) {
      const slot = document.createElement("div");
      slot.className = "time-cell";
      const label = document.createElement("span");
      label.textContent = hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
      slot.appendChild(label);
      gutter.appendChild(slot);
      if (hour < EH) {
        const half = document.createElement("div");
        half.className = "time-half";
        gutter.appendChild(half);
      }
    }
    weekGridRef.current.appendChild(gutter);

    dates.forEach((date, index) => {
      const dayKey = getDayKey(date);
      const isToday = date.toDateString() === today.toDateString();
      const col = document.createElement("div");
      col.className = `day-col${isToday ? " today-col" : ""}`;
      col.style.height = `${(EH - SH) * SLOT}px`;

      for (let hour = SH; hour < EH; hour += 1) {
        const hr = document.createElement("div");
        hr.className = "hr-line";
        hr.style.top = `${hPx(hour)}px`;
        col.appendChild(hr);

        const half = document.createElement("div");
        half.className = "hf-line";
        half.style.top = `${hPx(hour + 0.5)}px`;
        col.appendChild(half);
      }

      freeWindows
        .filter((window) => window.days.includes(dayKey))
        .forEach((window) => {
          const visibleMembers = window.memberIds.filter((memberId) => vis[memberId]);
          if (visibleMembers.length < Math.max(2, visCnt() - 1)) {
            return;
          }

          const overlay = document.createElement("div");
          overlay.className = "free-ov";
          overlay.style.cssText = `top:${hPx(window.s)}px;height:${dPx(window.s, Math.min(window.e, EH))}px`;
          overlay.innerHTML = `
            <div class="free-pips">${visibleMembers
              .map((memberId) => {
                const member = getMem(memberId);
                return member ? `<div class="free-pip" style="background:${member.bg}"></div>` : "";
              })
              .join("")}</div>
            <div class="free-ov-lbl">${visibleMembers.length >= visCnt() ? "All free" : "Available"}</div>
            <div class="free-ov-sub">${fmt(window.s)}–${fmt(window.e)}</div>
          `;
          overlay.addEventListener("mouseenter", (event) =>
            showTip(event, "Free window", [
              { dot: "#16a34a", txt: `${fmt(window.s)} – ${fmt(window.e)}` },
              { dot: "#16a34a", txt: window.dur },
              ...visibleMembers.map((memberId) => {
                const member = getMem(memberId);
                return member ? { dot: member.bg, txt: `${member.name} is free` } : null;
              }).filter(Boolean) as TipRow[],
            ]),
          );
          overlay.addEventListener("mouseleave", hideTip);
          overlay.onclick = () => openAddMeeting(window.days[0] ?? dayKey, window.s, window.e);
          col.appendChild(overlay);
        });

      const dayEvents: Array<CalendarBlock & { mem: CalendarMember }> = [];
      members
        .filter((member) => vis[member.id])
        .forEach((member) => {
          blocks
            .filter((block) => block.memberId === member.id && block.days.includes(dayKey) && block.s >= SH && block.e <= EH + 0.5)
            .forEach((block) => {
              dayEvents.push({ ...block, mem: member });
            });
        });

      const laid = layoutEvents(dayEvents);
      const gap = 2;

      laid.forEach((event) => {
        const height = Math.max(dPx(event.s, Math.min(event.e, EH)), 20);
        const cols = event._cols ?? 1;
        const slot = event._slot ?? 0;
        const leftPct = (slot / cols) * 100;
        const widthPct = (1 / cols) * 100;
        const mode = cols >= 3 ? "narrow" : cols === 2 ? "compact" : "wide";
        const block = document.createElement("div");
        block.className = `ev${event.routine ? " ev-routine" : ""}${mode === "narrow" ? " narrow" : ""}${mode === "compact" ? " compact" : ""}`;
        block.style.cssText = `top:${hPx(event.s)}px;height:${height}px;left:calc(${leftPct}% + ${slot === 0 ? 2 : gap}px);width:calc(${widthPct}% - ${slot === 0 ? gap + 2 : gap * 2}px);background:${event.routine ? event.mem.lt : event.mem.bg};`;

        const inner = document.createElement("div");
        inner.className = "ev-inner";
        inner.style.borderLeftColor = event.mem.bg;

        const tc = event.routine ? event.mem.tc : "#fff";
        const tcMuted = event.routine ? `${event.mem.tc}99` : "rgba(255,255,255,.75)";
        const pillBg = event.routine ? `${event.mem.bg}28` : "rgba(255,255,255,.2)";
        const pillFg = event.routine ? event.mem.bg : "#fff";
        const tagBg = event.routine ? `${event.mem.bg}14` : "rgba(255,255,255,.12)";
        const tagFg = event.routine ? event.mem.tc : "rgba(255,255,255,.8)";

        if (mode === "narrow") {
          const isShort = height < 34;
          if (isShort) {
            block.classList.add("short-block");
          }

          const title = document.createElement("div");
          title.className = "ev-title";
          title.style.color = tc;
          title.textContent = event.lbl;
          inner.appendChild(title);

          if (!isShort) {
            if (event.sub && height > 44) {
              const div = document.createElement("div");
              div.className = "ev-vdiv";
              inner.appendChild(div);

              const sub = document.createElement("div");
              sub.className = "ev-sub";
              sub.style.color = tcMuted;
              sub.textContent = event.sub;
              inner.appendChild(sub);
            }

            if (height > 56) {
              const pill = document.createElement("div");
              pill.className = "ev-npill";
              pill.style.cssText = `background:${pillBg};color:${pillFg}`;
              pill.textContent = event.mem.name;
              inner.appendChild(pill);
            }
          }
        } else if (mode === "compact") {
          const title = document.createElement("div");
          title.className = "ev-title";
          title.style.color = tc;
          title.textContent = event.lbl;
          inner.appendChild(title);

          if (height > 30 && event.sub) {
            const sub = document.createElement("div");
            sub.className = "ev-sub";
            sub.style.color = tcMuted;
            sub.textContent = event.sub;
            inner.appendChild(sub);
          }

          if (height > 46) {
            const pills = document.createElement("div");
            pills.className = "ev-pills";
            const memberPill = document.createElement("div");
            memberPill.className = "ev-pill";
            memberPill.style.cssText = `background:${pillBg};color:${pillFg}`;
            memberPill.textContent = event.mem.name;
            pills.appendChild(memberPill);
            inner.appendChild(pills);
          }
        } else {
          const title = document.createElement("div");
          title.className = "ev-title";
          title.style.color = tc;
          title.textContent = event.lbl;
          inner.appendChild(title);

          if (height > 28 && event.sub) {
            const sub = document.createElement("div");
            sub.className = "ev-sub";
            sub.style.color = tcMuted;
            sub.textContent = event.sub;
            inner.appendChild(sub);
          }

          if (height > 48) {
            const pills = document.createElement("div");
            pills.className = "ev-pills";
            const memberPill = document.createElement("div");
            memberPill.className = "ev-pill";
            memberPill.style.cssText = `background:${pillBg};color:${pillFg}`;
            memberPill.textContent = event.mem.name;
            pills.appendChild(memberPill);
            if (height > 64) {
              const typePill = document.createElement("div");
              typePill.className = "ev-pill";
              typePill.style.cssText = `background:${tagBg};color:${tagFg}`;
              typePill.textContent = event.routine ? "Routine" : "Manual";
              pills.appendChild(typePill);
            }
            inner.appendChild(pills);
          }
        }

        block.appendChild(inner);

        const overlapping = laid.filter((other) => other !== event && other.s < event.e - 0.01 && other.e > event.s + 0.01);
        const tipRows: TipRow[] = [
          { dot: event.mem.bg, txt: `${event.mem.name} · ${event.mem.role}` },
          { txt: `${fmt(event.s)} – ${fmt(event.e)}` },
          event.sub ? { txt: event.sub } : null,
          { txt: event.routine ? "Recurring routine" : "Manual block" },
        ].filter(Boolean) as TipRow[];

        if (overlapping.length) {
          tipRows.push({ txt: "──────────────" });
          tipRows.push({ txt: `${overlapping.length} other block${overlapping.length > 1 ? "s" : ""} at this time:` });
          overlapping.forEach((other) => {
            tipRows.push({ dot: other.mem.bg, txt: `${other.mem.name}: ${other.lbl}` });
          });
        }

        block.addEventListener("mouseenter", (mouseEvent) => showTip(mouseEvent, event.lbl, tipRows));
        block.addEventListener("mouseleave", hideTip);
        col.appendChild(block);
      });

      deadlines
        .filter((deadline) => deadline.days.includes(dayKey))
        .forEach((deadline) => {
          const chip = document.createElement("div");
          chip.className = "dl-chip";
          chip.textContent = `⚑ ${deadline.lbl}`;
          chip.addEventListener("mouseenter", (event) => showTip(event, "Deadline", [{ dot: "#dc2626", txt: deadline.lbl }]));
          chip.addEventListener("mouseleave", hideTip);
          col.appendChild(chip);
        });

      if (isToday && nowH >= SH && nowH <= EH) {
        const nowLine = document.createElement("div");
        nowLine.className = "now-line";
        nowLine.style.top = `${hPx(nowH)}px`;
        nowLine.innerHTML = '<div class="now-dot"></div><div class="now-bar"></div>';
        col.appendChild(nowLine);
      }

      weekGridRef.current?.appendChild(col);
    });

    heatGridRef.current.innerHTML = "";
    heatGridRef.current.style.gridTemplateColumns = `42px repeat(${WORKK.length},1fr)`;
    const corner = document.createElement("div");
    corner.className = "h-corner";
    corner.textContent = "Hour";
    heatGridRef.current.appendChild(corner);
    WORKD.forEach((day) => {
      const head = document.createElement("div");
      head.className = "h-dhead";
      head.textContent = day;
      heatGridRef.current?.appendChild(head);
    });
    for (let hour = 7; hour <= 20; hour += 1) {
      const timeLabel = document.createElement("div");
      timeLabel.className = "h-time";
      timeLabel.textContent = hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
      heatGridRef.current.appendChild(timeLabel);
      WORKK.forEach((dayKey) => {
        const count = busyCnt(dayKey, hour);
        const bucket = Math.min(count, 4);
        const cell = document.createElement("div");
        cell.className = "h-cell";
        cell.style.cssText = `background:${HCOLS[bucket]};border:1px solid ${HBDS[bucket]}`;
        if (count === 0) {
          cell.innerHTML = '<div style="width:5px;height:5px;border-radius:50%;background:#16a34a"></div>';
        } else {
          cell.innerHTML = `<div class="h-cval" style="color:${HTXT[bucket]}">${count >= visibleCount && visibleCount > 0 ? "✕" : count}</div>`;
        }
        const busyMembers = members.filter((member) => vis[member.id] && isBusy(member.id, dayKey, hour));
        cell.addEventListener("mouseenter", (mouseEvent) =>
          showTip(
            mouseEvent,
            `${dayKey.charAt(0).toUpperCase() + dayKey.slice(1, 3)} at ${fmt(hour)}`,
            count === 0 ? [{ dot: "#16a34a", txt: "Everyone is free" }] : busyMembers.map((member) => ({ dot: member.bg, txt: `${member.name} is busy` })),
          ),
        );
        cell.addEventListener("mouseleave", hideTip);
        if (count === 0) {
          cell.onclick = () => openAddMeeting(dayKey, hour, hour + 1);
        }
        heatGridRef.current!.appendChild(cell);
      });
    }

    dotsRef.current.innerHTML = "";
    const dotHours = Array.from({ length: 13 }, (_, index) => index + 7);
    const th = document.createElement("div");
    th.className = "d-th-row";
    dotHours.forEach((hour) => {
      const label = document.createElement("div");
      label.className = "d-th";
      label.textContent = hour === 12 ? "12P" : hour > 12 ? `${hour - 12}P` : `${hour}A`;
      th.appendChild(label);
    });
    dotsRef.current.appendChild(th);

    WORKK.forEach((dayKey, dayIndex) => {
      const section = document.createElement("div");
      section.className = "d-section";
      const dayLabel = document.createElement("div");
      dayLabel.className = "d-day-lbl";
      dayLabel.innerHTML = `<span>${WORKD[dayIndex]}</span><div class="d-div"></div>`;
      section.appendChild(dayLabel);

      members
        .filter((member) => vis[member.id])
        .forEach((member) => {
          const row = document.createElement("div");
          row.className = "d-mrow";
          const label = document.createElement("div");
          label.className = "d-mlabel";
          label.innerHTML = `<div class="d-av" style="background:${member.bg}">${member.ini}</div><span class="d-mname">${member.name}</span>`;
          row.appendChild(label);
          const track = document.createElement("div");
          track.className = "d-track";
          dotHours.forEach((hour) => {
            const busy = isBusy(member.id, dayKey, hour);
            const cell = document.createElement("div");
            cell.className = `d-cell${busy ? "" : " d-free"}`;
            if (busy) {
              cell.style.background = `${member.bg}CC`;
            } else {
              cell.innerHTML = '<div class="d-pip"></div>';
            }
            const block = blocks.find((candidate) => candidate.memberId === member.id && candidate.days.includes(dayKey) && hour >= candidate.s && hour < candidate.e);
            cell.addEventListener("mouseenter", (mouseEvent) =>
              showTip(mouseEvent, busy ? (block ? block.lbl : "Busy") : `${member.name} free`, [{ dot: member.bg, txt: member.name }, { txt: `${fmt(hour)} – ${fmt(hour + 1)}` }]),
            );
            cell.addEventListener("mouseleave", hideTip);
            track.appendChild(cell);
          });
          row.appendChild(track);
          section.appendChild(row);
        });

      const fwDay = freeWindows.filter((window) => window.days.includes(dayKey) && window.memberIds.filter((memberId) => vis[memberId]).length >= Math.max(2, visibleCount - 1));
      if (fwDay.length) {
        const fwRow = document.createElement("div");
        fwRow.className = "d-fw-row";
        fwDay.forEach((window) => {
          const badge = document.createElement("div");
          badge.className = "d-fw-b";
          badge.textContent = `${window.memberIds.filter((memberId) => vis[memberId]).length >= visibleCount ? "All" : "3+"} free · ${fmt(window.s)}–${fmt(window.e)}`;
          badge.onclick = () => openAddMeeting(window.days[0] ?? dayKey, window.s, window.e);
          fwRow.appendChild(badge);
        });
        section.appendChild(fwRow);
      }

      dotsRef.current!.appendChild(section);
    });

    freeListRef.current.innerHTML = "";
    WORKK.forEach((dayKey, dayIndex) => {
      const date = weekDates[dayIndex + 1];
      const isToday = date?.toDateString() === today.toDateString();
      const validFW = freeWindows.filter(
        (window) => window.days.includes(dayKey) && window.memberIds.filter((memberId) => vis[memberId]).length >= Math.max(2, visibleCount - 1),
      );
      const group = document.createElement("div");
      group.className = "fwo-group";
      const head = document.createElement("div");
      head.className = "fwo-head";
      const allCount = validFW.filter((window) => window.memberIds.filter((memberId) => vis[memberId]).length >= visibleCount).length;
      head.innerHTML = `<div style="display:flex;align-items:center;gap:6px">
        <span class="fwo-dname"${isToday ? ' style="color:var(--primary)"' : ""}>${WORKD[dayIndex]}</span>
        ${date ? `<span style="font-size:11px;color:var(--muted)">${date.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</span>` : ""}
        ${isToday ? '<span class="fwo-today">Today</span>' : ""}
      </div>
      ${validFW.length ? `<span class="fwo-cnt" style="background:${allCount > 0 ? "#f0fdf4" : "#fef9c3"};color:${allCount > 0 ? "#15803d" : "#854d0e"}">${validFW.length} window${validFW.length > 1 ? "s" : ""}</span>` : ""}`;
      group.appendChild(head);

      if (!validFW.length) {
        const no = document.createElement("div");
        no.className = "fwo-none";
        no.textContent = "No shared free windows on this day.";
        group.appendChild(no);
      } else {
        validFW.forEach((window) => {
          const freeMembers = window.memberIds.filter((memberId) => vis[memberId]);
          const busyMembers = members.filter((member) => vis[member.id] && !window.memberIds.includes(member.id));
          const isAll = freeMembers.length >= visibleCount;
          const row = document.createElement("div");
          row.className = "fwo-row";
          row.innerHTML = `
            <div class="fwo-tc"><div class="fwo-start">${fmt(window.s)}</div><div class="fwo-end">to ${fmt(window.e)}</div><div class="fwo-dur">${window.dur}</div></div>
            <div class="fwo-info">
              <div class="fwo-mems">${freeMembers
                .map((memberId) => {
                  const member = getMem(memberId);
                  return member ? `<div class="fwo-m"><div class="fwo-mdot" style="background:${member.bg}"></div>${member.name}</div>` : "";
                })
                .join("")}</div>
              ${busyMembers.length ? `<div class="fwo-absent">${busyMembers.map((member) => member.name).join(", ")} unavailable</div>` : `<div class="fwo-ok">All ${freeMembers.length} members available</div>`}
            </div>
            <div class="fwo-acts">
              <button class="btn btn-green" style="font-size:11px">Book</button>
              <div style="font-size:9px;color:var(--muted2);text-align:right">${isAll ? "Everyone free" : `${freeMembers.length}/${visibleCount} free`}</div>
            </div>`;
          const button = row.querySelector("button");
          button?.addEventListener("click", () => openAddMeeting(window.days[0] ?? dayKey, window.s, window.e));
          group.appendChild(row);
        });
      }

      freeListRef.current!.appendChild(group);
    });
  }, [blocks, deadlines, freeWindows, layout, members, nowTick, vis, weekDates]);

  const memberChips = members.map((member) => {
    const visible = Boolean(vis[member.id]);
    return (
      <button
        key={member.id}
        type="button"
        className={`m-chip${visible ? "" : " off"}`}
        onClick={() => toggleMember(member.id)}
        style={{ borderColor: visible ? member.bd : "var(--border2)" }}
      >
        <div className="m-av" style={{ background: member.bg, opacity: visible ? 1 : 0.4 }}>
          {member.ini}
        </div>
        <div className="m-chip-info">
          <div className="m-chip-name" style={{ color: visible ? member.tc : "var(--muted2)" }}>
            {member.name}
          </div>
          <div className="m-chip-role">{member.role}</div>
        </div>
        <div className="m-chip-check">
          {visible ? (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1.5 4L3 5.5L6.5 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </div>
      </button>
    );
  });

  return (
    <>
      <style jsx global>{CALENDAR_STYLES}</style>
      <div className="cc-root">
      <div className="app-bar">
        <div className="app-id">
          <div className="logo">CS</div>
          <div>
            <div className="app-name">CAPSync</div>
            <div className="app-sub">
              Group calendar · <span>{weekLabel}</span>
            </div>
          </div>
        </div>
        <div className="ltabs">
          <button className={`lt${layout === "week" ? " on" : ""}`} onClick={() => setLayout("week")}>
            <span className="lt-ico">📅</span>
            <span className="lt-name">Calendar</span>
            <span className="lt-hint">Week grid</span>
          </button>
          <button className={`lt${layout === "heat" ? " on" : ""}`} onClick={() => setLayout("heat")}>
            <span className="lt-ico">▦</span>
            <span className="lt-name">Heat map</span>
            <span className="lt-hint">Density</span>
          </button>
          <button className={`lt${layout === "dots" ? " on" : ""}`} onClick={() => setLayout("dots")}>
            <span className="lt-ico">⠿</span>
            <span className="lt-name">Availability</span>
            <span className="lt-hint">Dot grid</span>
          </button>
          <button className={`lt${layout === "free" ? " on" : ""}`} onClick={() => setLayout("free")}>
            <span className="lt-ico">◈</span>
            <span className="lt-name">Free windows</span>
            <span className="lt-hint">Clutter-free</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="tb">
          <div className="tb-l">
            <button className="btn btn-ghost btn-icon" onClick={() => setWkOff((current) => current - 1)}>
              &#8249;
            </button>
            <button className="btn btn-outline" style={{ fontSize: 11 }} onClick={() => setWkOff(0)}>
              Today
            </button>
            <button className="btn btn-ghost btn-icon" onClick={() => setWkOff((current) => current + 1)}>
              &#8250;
            </button>
            <span className="wk-title">{weekLabel}</span>
          </div>
          <div className="tb-r">
            <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={() => {
              setMeetingPrefill({});
              setAddMeetingOpen(true);
            }}>
              Add meeting
            </button>
            <button className="suggest-btn" onClick={doSuggest}>
              ✦ Suggest meeting
            </button>
          </div>
        </div>

        <div className="fp">
          <span className="fp-lbl">Members</span>
          <div className="fp-chips">{memberChips}</div>
          <div className="fp-right">
            <span className="fp-info">{visibleCount} of {members.length} visible</span>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={showAll}>
              Show all
            </button>
          </div>
        </div>

        <div className={`view${layout === "week" ? " on" : ""}`} id="view-week">
          <div className="wk-head">
            <div className="wk-head-spacer" />
            <div ref={weekHeadersRef} style={{ display: "contents" }} />
          </div>
          <div className="wk-scroll" ref={scrollRef}>
            <div className="wk-grid" ref={weekGridRef} />
          </div>
          <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", background: "var(--bg2)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div className="leg"><div className="lsw lsw-r" />Routine (auto-repeating)</div>
            <div className="leg"><div className="lsw lsw-m" />Manual block</div>
            <div className="leg"><div className="lsw lsw-f" />Free window</div>
            <div className="leg"><div className="lsw" style={{ background: "var(--red)", borderRadius: "50%" }} />Deadline</div>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted2)" }}>
              1 event = full detail · 2 = title only · 3+ = vertical title · hover any block for all details
            </span>
          </div>
        </div>

        <div className={`view${layout === "heat" ? " on" : ""}`} id="view-heat">
          <div className="heat-wrap">
            <div className="heat-caption">
              Color = how many visible members are busy each hour. <strong>Green = everyone free.</strong>
            </div>
            <div className="heat-scroll">
              <div className="heat-grid" ref={heatGridRef} />
            </div>
            <div className="h-leg">
              <div className="hl"><div className="hl-sw" style={{ background: "#f0fdf4", border: "1px solid #86efac" }} />0 — all free</div>
              <div className="hl"><div className="hl-sw" style={{ background: "#dbeafe" }} />1 busy</div>
              <div className="hl"><div className="hl-sw" style={{ background: "#93c5fd" }} />2 busy</div>
              <div className="hl"><div className="hl-sw" style={{ background: "#3b82f6" }} />3 busy</div>
              <div className="hl"><div className="hl-sw" style={{ background: "#1e3a8a" }} />All busy</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginTop: 14, marginBottom: 6 }}>Best shared windows</div>
            <div className="f-badges">
              {freeWindows
                .filter((window) => window.memberIds.filter((memberId) => vis[memberId]).length >= visibleCount)
                .map((window) => (
                  <div key={`${window.days.join("-")}-${window.s}-${window.e}`} className="f-badge" onClick={() => openAddMeeting(window.days[0] ?? "mon", window.s, window.e)}>
                    ✓ {window.lbl} · {window.dur}
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className={`view${layout === "dots" ? " on" : ""}`} id="view-dots">
          <div className="dots-wrap">
            <div className="dots-scroll">
              <div className="dots-inner" ref={dotsRef} />
            </div>
          </div>
        </div>

        <div className={`view${layout === "free" ? " on" : ""}`} id="view-free">
          <div className="fwo-wrap">
            <div className="fwo-caption">Busy blocks hidden. Only shared free windows shown. Click <strong>Book</strong> to schedule.</div>
            <div ref={freeListRef} />
          </div>
        </div>

        <div className="sbar">
          <div className="leg-row">
            <div className="leg"><div className="lsw lsw-r" />Routine</div>
            <div className="leg"><div className="lsw lsw-m" />Manual</div>
            <div className="leg"><div className="lsw lsw-f" />Free</div>
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {visibleCount} members visible · {sharedFreeWindowCount} shared free windows this week
          </span>
        </div>
      </div>

      <div id="tip" ref={tipRef} />

      <AddMeetingDialog
        open={addMeetingOpen}
        onOpenChange={setAddMeetingOpen}
        groupId={groupId}
        members={members}
        prefillDay={meetingPrefill.day}
        prefillStart={meetingPrefill.start}
        prefillEnd={meetingPrefill.end}
      />
      </div>
    </>
  );
}
