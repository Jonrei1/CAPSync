"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import type { TrackerSprint } from "@/types";
import { designTokens } from "@/components/ui/design-standard";
import { cn } from "@/lib/utils";

const fieldClassName = cn(designTokens.spacing.field, "gap-2");
const inputClassName = "rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function SprintWindowEditor({
  sprint,
  onSaved,
}: {
  sprint: TrackerSprint;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(sprint.title);
  const [goal, setGoal] = useState(sprint.goal ?? "");
  const [start, setStart] = useState(sprint.start_date);
  const [end, setEnd] = useState(sprint.end_date);
  const [saving, setSaving] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  async function save() {
    if (new Date(end) < new Date(start)) {
      toast.error("Invalid date range", "End date must be after start date.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/tracker/sprints/${sprint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          goal: goal.trim(),
          start_date: start,
          end_date: end,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save sprint.");
      }

      toast.success("Sprint window updated", "Changes saved.");
      setIsEditing(false);
      onSaved();
    } catch (error) {
      toast.error("Sprint not saved", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="mt-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="h-7 text-xs text-muted-foreground hover:bg-muted"
        >
          <Settings2 className="mr-1.5 size-3.5" />
          Edit sprint details
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 grid gap-3 rounded-lg border bg-muted/30 p-3 shadow-xs">
      <div className={fieldClassName}>
        <Label htmlFor={`sprint-title-${sprint.id}`} className="text-xs font-medium">
          Title
        </Label>
        <Input
          id={`sprint-title-${sprint.id}`}
          className={inputClassName}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sprint title"
        />
      </div>

      <div className={fieldClassName}>
        <Label htmlFor={`sprint-goal-${sprint.id}`} className="text-xs font-medium">
          Goal
        </Label>
        <Input
          id={`sprint-goal-${sprint.id}`}
          className={inputClassName}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Sprint goal"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClassName}>
          <Label htmlFor={`sprint-start-${sprint.id}`} className="text-xs font-medium">
            Start date
          </Label>
          <Input
            id={`sprint-start-${sprint.id}`}
            type="date"
            className={inputClassName}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>

        <div className={fieldClassName}>
          <Label htmlFor={`sprint-end-${sprint.id}`} className="text-xs font-medium">
            End date
          </Label>
          <Input
            id={`sprint-end-${sprint.id}`}
            type="date"
            className={inputClassName}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-1">
        <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save details"}
        </Button>
      </div>
    </div>
  );
}
