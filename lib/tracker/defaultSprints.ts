export type SprintPreset = {
  title: string;
  goal: string;
  weekOffset: number;
  durationWeeks: number;
};

export const THESIS_SPRINT_PRESETS: SprintPreset[] = [
  {
    title: "Sprint 1 — Topic selection & proposal",
    goal: "Define research gap, agree on topic, draft concept paper.",
    weekOffset: 0,
    durationWeeks: 2,
  },
  {
    title: "Sprint 2 — Literature review",
    goal: "Gather 20+ sources, synthesise related work section.",
    weekOffset: 2,
    durationWeeks: 2,
  },
  {
    title: "Sprint 3 — Methodology & design",
    goal: "Finalise research design, data instruments, ethics form.",
    weekOffset: 4,
    durationWeeks: 2,
  },
  {
    title: "Sprint 4 — Implementation",
    goal: "Build prototype or collect and clean data.",
    weekOffset: 6,
    durationWeeks: 3,
  },
  {
    title: "Sprint 5 — Testing & evaluation",
    goal: "Run tests, analyse results, write findings chapter.",
    weekOffset: 9,
    durationWeeks: 2,
  },
  {
    title: "Sprint 6 — Final paper & defense prep",
    goal: "Compile full manuscript, slides, and prepare for mock oral defence.",
    weekOffset: 11,
    durationWeeks: 2,
  },
];

export function buildThesisSprints(startDate: Date) {
  return THESIS_SPRINT_PRESETS.map((preset) => {
    const start = new Date(startDate);
    start.setDate(start.getDate() + preset.weekOffset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + preset.durationWeeks * 7 - 1);
    return {
      title: preset.title,
      goal: preset.goal,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    };
  });
}
