"use client";

import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { format } from "date-fns";

export type DeadlineItem = {
  id: string;
  label: string;
};

type DeadlineModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  deadlines: DeadlineItem[];
};

export default function DeadlineModal({
  open,
  onOpenChange,
  date,
  deadlines,
}: DeadlineModalProps) {
  if (!date) return null;

  const formattedDate = format(date, "MMMM d, yyyy");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-lg p-6">
        <DialogHeader className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">{formattedDate}</h2>
        </DialogHeader>

        <div className="space-y-3">
          {deadlines.map((deadline) => (
            <div
              key={deadline.id}
              className="flex items-center justify-between rounded-md border border-border/50 bg-card/50 px-4 py-3"
            >
              <span className="text-sm text-foreground font-medium">{deadline.label}</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Deadline
              </span>
            </div>
          ))}

          {deadlines.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No deadlines for this day
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
