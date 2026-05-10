"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  useEffect(() => {
    if (open) {
      setSelected(methodology);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose tracker methodology</DialogTitle>
          <p className="text-xs text-muted-foreground">
            PMs can reorganize the tracker around sprints, soft iterations, phase gates, or continuous flow.
          </p>
        </DialogHeader>
        <DialogBody>
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
          <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
            {METHODOLOGIES[selected].preview}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={saveMethodology} disabled={saving}>
            {saving ? "Saving..." : "Apply methodology"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
