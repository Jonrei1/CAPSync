"use client";

import { useEffect, useState } from "react";
import { Calendar, CheckSquare2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { designStandard } from "@/components/ui/design-standard";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { Methodology } from "@/types";
import { METHODOLOGIES } from "./tracker-utils";

type MethodologyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  methodology: Methodology;
  onSaved: () => void;
};

export default function MethodologyDialog({ open, onOpenChange, groupId, methodology, onSaved }: MethodologyDialogProps) {
  const [selected, setSelected] = useState<Methodology>(methodology);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const requiresSprintStructure = selected === "scrum" || selected === "agile";

  useEffect(() => {
    if (open) {
      setSelected(methodology);
      setShowConfirm(false);
    }
    if (!open) {
      setShowConfirm(false);
    }
  }, [methodology, open]);

  async function saveMethodology() {
    setSaving(true);
    try {
      const response = await fetch(`/api/tracker/groups/${groupId}/methodology`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methodology: selected }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update methodology.");
      }

      toast.success("Methodology updated", METHODOLOGIES[selected].name);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error("Methodology not changed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleApplyClick() {
    setShowConfirm(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{showConfirm ? "Confirm methodology change" : "Choose tracker methodology"}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {showConfirm
              ? "Review the workflow change before applying it to the tracker."
              : "PMs can reorganize the tracker around sprints, soft iterations, phase gates, or continuous flow."}
          </p>
        </DialogHeader>
        <DialogBody>
          {showConfirm ? (
            <div className="space-y-3">
              <div className={cn(designStandard.cards.mutedPanel, "border-border/70 bg-muted/30 px-4 py-4 text-foreground")}>
                <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">What changes</div>
                {requiresSprintStructure ? (
                  <>
                    <p className="mb-4 text-sm leading-6 text-foreground/80">
                      This methodology tightens task creation rules so sprint planning stays explicit and deadlines stay inside the sprint window.
                    </p>
                    <ul className="space-y-3 text-sm leading-6 text-foreground">
                      <li className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-3">
                        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <CheckSquare2 className="size-4" />
                        </span>
                        <span>
                          <span className="block font-medium">Sprint assignment becomes required</span>
                          <span className="block text-xs leading-5 text-muted-foreground">
                            Every task must belong to a sprint before it can be created, which keeps ownership and sequencing clear.
                          </span>
                        </span>
                      </li>
                      <li className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-3">
                        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Calendar className="size-4" />
                        </span>
                        <span>
                          <span className="block font-medium">Due dates are constrained to the sprint window</span>
                          <span className="block text-xs leading-5 text-muted-foreground">
                            Dates outside the selected sprint&apos;s start/end range are blocked, so the schedule stays realistic.
                          </span>
                        </span>
                      </li>
                      <li className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-3">
                        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <LockKeyhole className="size-4" />
                        </span>
                        <span>
                          <span className="block font-medium">New tasks start in To do</span>
                          <span className="block text-xs leading-5 text-muted-foreground">
                            Status is locked on creation so work enters the board in a predictable, unstarted state.
                          </span>
                        </span>
                      </li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-sm leading-6 text-foreground/80">
                      This mode relaxes sprint rules so tasks can move through the tracker without a planning gate.
                    </p>
                    <ul className="space-y-3 text-sm leading-6 text-foreground">
                      <li className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-3">
                        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <CheckSquare2 className="size-4" />
                        </span>
                        <span>
                          <span className="block font-medium">Sprint and phase links are ignored</span>
                          <span className="block text-xs leading-5 text-muted-foreground">
                            Tasks can be created without selecting a sprint or phase, which is useful for lighter-weight workflows.
                          </span>
                        </span>
                      </li>
                      <li className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-3">
                        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Calendar className="size-4" />
                        </span>
                        <span>
                          <span className="block font-medium">Due dates stay flexible</span>
                          <span className="block text-xs leading-5 text-muted-foreground">
                            The tracker does not enforce sprint boundaries, so dates can be set freely based on the task itself.
                          </span>
                        </span>
                      </li>
                    </ul>
                  </>
                )}
              </div>

              {requiresSprintStructure ? (
                <p className="text-xs italic leading-5 text-muted-foreground">
                  Scrum enforces sprint ownership. A task without a sprint is a planning smell — prompt the user to assign one before submitting.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(METHODOLOGIES) as Methodology[]).map((key) => {
                const method = METHODOLOGIES[key];
                const Icon = method.icon;
                const active = selected === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    className={cn(
                      "cursor-pointer rounded-lg border p-3 text-left transition hover:bg-muted/60",
                      active && "border-zinc-900 bg-muted shadow-xs",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="size-4" />
                      <span className="text-sm font-semibold">{method.name}</span>
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">{method.description}</span>
                  </button>
                );
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {showConfirm ? (
            <>
              <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={saving} className={designStandard.button.outline}>
                Back
              </Button>
              <Button onClick={saveMethodology} disabled={saving} className={designStandard.button.solidPrimary}>
                {saving ? "Saving..." : "Confirm change"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className={designStandard.button.outline}>
                Cancel
              </Button>
              <Button onClick={handleApplyClick} disabled={saving} className={designStandard.button.solidPrimary}>
                Apply methodology
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
