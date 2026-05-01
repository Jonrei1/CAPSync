# Prompt: Compact Two-Tier Calendar Header (no horizontal scroll)

## Context

File to edit: `components/circle-calendar/CalendarShell.tsx`

The current `<header>` renders two visual areas stacked vertically:

1. **Top card** (`<header>` element) — group avatar + name + subject/week label on the left; four view-mode toggle buttons (Calendar, Heat map, Availability, Free windows) on the right.
2. **Inner nav bar** (inside `weekView`) — prev/next/Today buttons + week range label + Go-to-date popover on the left; Add routine + Suggest meeting buttons on the right.

Both together are ~96–112 px tall. The goal is to collapse them into **two slim rows totalling ~76 px** with no horizontal overflow at any viewport width. Do **not** modify `WeekCalendarGrid` or any other child component. Keep every existing `onClick` handler, state variable, and prop binding exactly as they are.

---

## Target Structure

Replace the existing `<header>` block and the nav bar inside `weekView` with this two-row structure placed **above** `weekView`, wrapped in a single card div:

```
┌─────────────────────────────────────────────────────────────────────────┐  ← Row 1  ~40px
│  [Avatar] [Group name]  [subject · week range]    [Cal][Heat][Avail][Free]  │
├─────────────────────────────────────────────────────────────────────────┤
│  [‹] [Today] [›]  Apr 26 – May 2  [Go to date ▾]  ·  [+ Add routine] [Suggest meeting]  │  ← Row 2  ~36px
└─────────────────────────────────────────────────────────────────────────┘
```

Both rows share one wrapper `<div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden mb-2">`.

---

## Row 1 — Identity + View tabs

```tsx
<div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/70">

  {/* Left: avatar + name + meta */}
  <div className="flex items-center gap-2 min-w-0">
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[9px] font-bold text-primary-foreground">
      {initials}
    </div>
    <span className="text-sm font-semibold tracking-tight text-foreground truncate max-w-[120px]">
      {groupName}
    </span>
    <span className="hidden sm:inline text-[11px] text-muted-foreground truncate">
      {groupSubject} · {weekLabel}
    </span>
  </div>

  {/* Right: view-mode tabs */}
  <div className="flex items-center gap-1 shrink-0">
    {VIEW_TABS.map(tab => (
      <button
        key={tab.key}
        type="button"
        onClick={() => setLayout(tab.key)}
        className={cn(
          "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-all",
          layout === tab.key
            ? "border-primary bg-primary text-primary-foreground"
            : "border-transparent text-muted-foreground hover:border-border/70 hover:text-foreground"
        )}
      >
        <span className="text-xs leading-none">{tab.icon}</span>
        <span className="hidden md:inline">{tab.label}</span>
      </button>
    ))}
  </div>

</div>
```

Add this constant near the top of the component (replaces the inline array in the existing `<header>`):

```ts
const VIEW_TABS = [
  { key: "week" as Layout, label: "Calendar",     icon: "📅" },
  { key: "heat" as Layout, label: "Heat map",     icon: "▦"  },
  { key: "dots" as Layout, label: "Availability", icon: "⠿"  },
  { key: "free" as Layout, label: "Free windows", icon: "◈"  },
] as const;
```

---

## Row 2 — Week nav + Actions

```tsx
<div className="flex items-center justify-between gap-2 px-3 py-1">

  {/* Left: week navigation + date picker */}
  <div className="flex items-center gap-1.5 min-w-0">
    <Button variant="outline" size="icon-sm" onClick={() => navigateToWeek(weekOffset - 1)}>&#8249;</Button>
    <Button variant="outline" size="sm"      onClick={() => navigateToWeek(0)}>Today</Button>
    <Button variant="outline" size="icon-sm" onClick={() => navigateToWeek(weekOffset + 1)}>&#8250;</Button>

    <span className="text-sm font-medium text-foreground min-w-[108px] text-center hidden sm:inline">
      {weekLabel}
    </span>

    {/* Keep existing Popover/Calendar markup — only shrink the trigger button */}
    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
      <PopoverTrigger render={
        <Button variant="outline" size="sm" className="gap-1 text-[11px] text-muted-foreground font-normal">
          {weekStart ? format(weekStart, "MMM d, yyyy") : "Pick date"}
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      } />
      <PopoverContent className={cn(ds.calendar.dateJumpPopover)} align="start">
        <Calendar
          mode="single"
          selected={weekStart}
          defaultMonth={weekStart}
          onSelect={(nextDate) => {
            if (!nextDate) return;
            navigateToWeek(getWeekOffsetForDate(nextDate));
            setDatePickerOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  </div>

  {/* Right: action buttons */}
  <div className="flex items-center gap-1.5 shrink-0">
    <Button variant="outline"   size="sm" onClick={() => setShowRoutineDialog(true)}>
      <span className="hidden sm:inline">Add routine</span>
      <span className="sm:hidden">+ Routine</span>
    </Button>
    <Button variant="secondary" size="sm" onClick={doSuggest}>
      <span className="hidden md:inline">Suggest meeting</span>
      <span className="md:hidden">Suggest</span>
    </Button>
  </div>

</div>
```

---

## Remove / relocate

| What | Action |
|---|---|
| Existing `<header>` element (group info + view tabs) | Delete — content moves to Row 1 |
| Nav bar `<div>` inside `weekView` (Today/prev/next/date picker/Add routine/Suggest meeting) | Delete — content moves to Row 2 |
| Back `<Link>` and its outer wrapper `<div>` in `page.tsx` | Move into Row 1 as the leftmost item (before avatar), keep existing classes, remove the outer wrapper `<div>` from `page.tsx` |

---

## Sizing reference

| Element | Tailwind |
|---|---|
| Shared card wrapper | `rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden mb-2` |
| Row 1 wrapper | `flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/70` |
| Row 2 wrapper | `flex items-center justify-between gap-2 px-3 py-1` |
| Avatar | `h-6 w-6 rounded-md text-[9px]` |
| Group name | `text-sm font-semibold max-w-[120px] truncate` |
| Subject + week meta | `text-[11px] text-muted-foreground hidden sm:inline truncate` |
| Tab button (active) | `border-primary bg-primary text-primary-foreground px-2 py-1 rounded-md text-[10px]` |
| Tab button (inactive) | `border-transparent text-muted-foreground px-2 py-1 rounded-md text-[10px]` |
| Tab label text | `hidden md:inline` |
| Week range label | `text-sm font-medium min-w-[108px] text-center hidden sm:inline` |
| Go-to-date trigger | `size="sm" text-[11px] font-normal` |
| Action buttons | `size="sm"` with responsive label (see Row 2 spec) |

---

## Responsive rules (no overflow-x-auto anywhere)

| Breakpoint | Behaviour |
|---|---|
| All widths | Both rows fit without horizontal scroll — content is hidden progressively, never clipped |
| `< md` (< 768 px) | Tab text labels hidden — icons only. "Suggest meeting" → "Suggest" |
| `< sm` (< 640 px) | Subject/week meta hidden. Week range label hidden. "Add routine" → "+ Routine" |

---

## What NOT to change

- `WeekCalendarGrid`, `HeatMapGrid`, `AvailabilityGrid`, `FreeWindowsView` — untouched.
- All `onClick` handlers, state (`layout`, `weekOffset`, `datePickerOpen`, etc.), and prop bindings — untouched.
- **Members row** (pill chips + Show all / Hide all) — stays inside `weekView`, unchanged.
- Legend footer row at the bottom of the calendar card — untouched.

---

## Expected outcome

- Combined header: **~76 px** (two slim rows) vs ~108 px before.
- No horizontal scrollbar at any viewport width.
- All controls remain accessible and functional.
- Calendar grid gains ~32 px of additional visible height.
