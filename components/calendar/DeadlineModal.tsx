"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { designStandard } from "@/components/ui/design-standard";
import { format } from "date-fns";

export type DeadlineItem = {
  id: string;
  label: string;
  href?: string;
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
  const router = useRouter();

  if (!date) return null;

  const formattedDate = format(date, "MMMM d, yyyy");
  const deadlineCount = deadlines.length;

  function openDeadline(deadline: DeadlineItem) {
    if (!deadline.href) {
      return;
    }

    onOpenChange(false);
    router.push(deadline.href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className={designStandard.modal.header}>
          <div className={designStandard.modal.badge}>Deadlines</div>
          <DialogTitle className={designStandard.modal.title}>{formattedDate}</DialogTitle>
          <p className={designStandard.modal.description}>
            {deadlineCount > 0
              ? `${deadlineCount} deadline${deadlineCount === 1 ? "" : "s"} scheduled for this day.`
              : "No deadlines scheduled for this day."}
          </p>
        </DialogHeader>

        <DialogBody className={designStandard.modal.body}>
          <div className="space-y-3">
            {deadlines.map((deadline) => {
              const isNavigable = Boolean(deadline.href);

              return (
                <button
                  key={deadline.id}
                  type="button"
                  onClick={() => openDeadline(deadline)}
                  disabled={!isNavigable}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-left shadow-sm transition-colors",
                    isNavigable ? "cursor-pointer hover:bg-muted/60 hover:border-border" : "cursor-default opacity-80",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="size-2 rounded-full bg-red-600" aria-hidden="true" />
                    <span className="truncate text-sm font-medium text-foreground">{deadline.label}</span>
                  </div>
                  <span className="shrink-0 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {isNavigable ? "Open in Tracker" : "Deadline"}
                  </span>
                </button>
              );
            })}

            {deadlines.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
                <div className="text-sm font-medium text-foreground">Nothing due here</div>
                <div className="mt-1 text-xs text-muted-foreground">This day is clear for now.</div>
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
