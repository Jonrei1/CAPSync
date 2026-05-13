"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { designTokens } from "@/components/ui/design-standard";
import { cn } from "@/lib/utils";

const fieldClassName = cn(designTokens.spacing.field, "gap-2");
const inputClassName = "rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type Mode = "choose" | "preset" | "custom";

type CustomSprint = {
  title: string;
  goal: string;
  start_date: string;
  end_date: string;
};

export default function SprintScaffoldBanner({
  groupId,
  onSaved,
}: {
  groupId: string;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [presetStartDate, setPresetStartDate] = useState("");
  const [customSprints, setCustomSprints] = useState<CustomSprint[]>([
    { title: "", goal: "", start_date: "", end_date: "" },
  ]);
  const [loading, setLoading] = useState(false);

  function addCustomSprint() {
    setCustomSprints([
      ...customSprints,
      { title: "", goal: "", start_date: "", end_date: "" },
    ]);
  }

  function removeCustomSprint(index: number) {
    setCustomSprints(customSprints.filter((_, i) => i !== index));
  }

  function updateCustomSprint(
    index: number,
    field: keyof CustomSprint,
    value: string
  ) {
    const updated = [...customSprints];
    updated[index]![field] = value;
    setCustomSprints(updated);
  }

  async function scaffoldPreset() {
    if (!presetStartDate) {
      toast.error("Pick a date", "Select a semester start date first.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/tracker/sprints/scaffold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          startDate: presetStartDate,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to scaffold sprints.");
      }

      toast.success("Sprints created", "6 thesis sprints have been generated.");
      onSaved();
      setMode("choose");
      setPresetStartDate("");
    } catch (error) {
      toast.error("Sprints not created", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function createCustomSprints() {
    const invalid = customSprints.filter(
      (s) => !s.title.trim() || !s.start_date || !s.end_date
    );
    if (invalid.length > 0) {
      toast.error("Incomplete sprints", "All sprints need a title, start date, and end date.");
      return;
    }

    const withInvalidDateOrder = customSprints.filter(
      (s) => new Date(s.end_date) < new Date(s.start_date)
    );
    if (withInvalidDateOrder.length > 0) {
      toast.error("Invalid date range", "End date must be after start date for all sprints.");
      return;
    }

    setLoading(true);
    try {
      // Create each sprint individually
      const created = await Promise.all(
        customSprints.map((sprint) =>
          fetch("/api/tracker/sprints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              groupId,
              title: sprint.title.trim(),
              goal: sprint.goal.trim(),
              start_date: sprint.start_date,
              end_date: sprint.end_date,
            }),
          })
        )
      );

      const failed = created.filter((r) => !r.ok);
      if (failed.length > 0) {
        throw new Error("Some sprints failed to create.");
      }

      toast.success("Sprints created", `${customSprints.length} sprint(s) added.`);
      onSaved();
      setMode("choose");
      setCustomSprints([{ title: "", goal: "", start_date: "", end_date: "" }]);
    } catch (error) {
      toast.error("Sprints not created", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "choose") {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Get started with sprints</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a sprint structure for your tracker. Choose a preset template or add custom sprints.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("preset")}
            className="flex flex-col items-start rounded-lg border border-violet-200 bg-white p-3 text-left transition hover:bg-violet-50"
          >
            <div className="font-medium text-sm">Use thesis template</div>
            <div className="mt-1 text-xs text-muted-foreground">
              6 pre-configured sprints for capstone projects
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode("custom")}
            className="flex flex-col items-start rounded-lg border border-violet-200 bg-white p-3 text-left transition hover:bg-violet-50"
          >
            <div className="font-medium text-sm">Create custom sprints</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Build your own sprint structure
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "preset") {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && setMode("choose")}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate thesis sprints</DialogTitle>
          </DialogHeader>
          <DialogBody className="gap-4">
            <p className="text-sm text-muted-foreground">
              Choose when your capstone project starts. The system will create 6 sprints spanning 13 weeks.
            </p>
            <div className={fieldClassName}>
              <Label htmlFor="preset-start-date" className="text-xs font-medium">
                Semester start date
              </Label>
              <DatePicker
                id="preset-start-date"
                value={presetStartDate}
                onChange={(v) => setPresetStartDate(v)}
                className={inputClassName}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMode("choose")}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              onClick={scaffoldPreset}
              disabled={loading || !presetStartDate}
            >
              {loading ? "Creating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={mode === "custom"} onOpenChange={(open) => !open && setMode("choose")}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create custom sprints</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Build your sprint structure. You can add or remove sprints anytime.
          </p>
        </DialogHeader>
        <DialogBody className="max-h-96 gap-4 overflow-y-auto">
          {customSprints.map((sprint, index) => (
            <div key={index} className="rounded-lg border border-border/50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">Sprint {index + 1}</div>
                {customSprints.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCustomSprint(index)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className={fieldClassName}>
                <Label htmlFor={`sprint-title-${index}`} className="text-xs font-medium">
                  Title
                </Label>
                <Input
                  id={`sprint-title-${index}`}
                  className={inputClassName}
                  placeholder="e.g. Topic selection & proposal"
                  value={sprint.title}
                  onChange={(e) => updateCustomSprint(index, "title", e.target.value)}
                />
              </div>

              <div className={fieldClassName}>
                <Label htmlFor={`sprint-goal-${index}`} className="text-xs font-medium">
                  Goal (optional)
                </Label>
                <Input
                  id={`sprint-goal-${index}`}
                  className={inputClassName}
                  placeholder="e.g. Define research gap and draft proposal"
                  value={sprint.goal}
                  onChange={(e) => updateCustomSprint(index, "goal", e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className={fieldClassName}>
                  <Label htmlFor={`sprint-start-${index}`} className="text-xs font-medium">
                    Start date
                  </Label>
                  <DatePicker
                    id={`sprint-start-${index}`}
                    value={sprint.start_date}
                    onChange={(v) => updateCustomSprint(index, "start_date", v)}
                    className={inputClassName}
                  />
                </div>

                <div className={fieldClassName}>
                  <Label htmlFor={`sprint-end-${index}`} className="text-xs font-medium">
                    End date
                  </Label>
                  <DatePicker
                    id={`sprint-end-${index}`}
                    value={sprint.end_date}
                    onChange={(v) => updateCustomSprint(index, "end_date", v)}
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>
          ))}
        </DialogBody>

        <div className="border-t px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={addCustomSprint}
            disabled={loading}
            className="w-full"
          >
            + Add sprint
          </Button>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setMode("choose")}
            disabled={loading}
          >
            Back
          </Button>
          <Button
            onClick={createCustomSprints}
            disabled={loading || customSprints.length === 0}
          >
            {loading ? "Creating..." : "Create sprints"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
