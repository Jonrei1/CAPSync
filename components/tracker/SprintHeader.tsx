"use client";

import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "./mini";
import type { TrackerSprint } from "@/types";
import { getSprintProgress, normalizeSprintStatus } from "./tracker-utils";

type SprintHeaderProps = {
  sprint: TrackerSprint;
  locked?: boolean;
};

export default function SprintHeader({ sprint, locked = false }: SprintHeaderProps) {
  const progress = getSprintProgress(sprint);
  const status = normalizeSprintStatus(sprint.status);
  const statusLabel = locked ? "Locked" : status === "done" ? "Complete" : status === "active" ? "Active" : "Upcoming";

  return (
    <div className="rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50 to-green-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-blue-800">{sprint.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {format(parseISO(sprint.start_date), "MMM d")} - {format(parseISO(sprint.end_date), "MMM d")} ·{" "}
            {progress.done}/{progress.total} tasks done
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            locked
              ? "border-zinc-200 bg-zinc-100 text-zinc-600"
              : status === "done"
                ? "border-green-200 bg-green-50 text-green-700"
                : status === "active"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
          }
        >
          {statusLabel}
        </Badge>
      </div>
      <ProgressBar value={progress.percent} className="mt-3" />
    </div>
  );
}
