"use client";

import { useEffect, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { differenceInDays, isAfter, isBefore, parseISO } from "date-fns";
import { CalendarDays, CheckCircle2, ClipboardList, Flag, Layers3, ListTodo, Tag, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { designStandard, designTokens } from "@/components/ui/design-standard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { Methodology, Profile, TaskStatus, TrackerSprint } from "@/types";
import { getDisplayName, STATUS_LABELS, TASK_STATUSES } from "./tracker-utils";

type TaskFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: Profile[];
  sprints: TrackerSprint[];
  currentUserId: string;
  canManage: boolean;
  methodology: Methodology;
  defaultStatus?: TaskStatus;
  defaultSprintId?: string | null;
  defaultDueDate?: string | null;
  onSaved: () => void;
};

type FormState = {
  title: string;
  description: string;
  sprintId: string;
  status: TaskStatus;
  assignedTo: string;
  dueDate: string;
  category: string;
  priority: string;
};

type MethodCfg = {
  sprintLabel: string;
  sprintShow: boolean;
  sprintRequired: boolean;
  dueSuggested: boolean;
  categoryProminent: boolean;
  statusProminent: boolean;
  submitLabel: string;
};

const METHOD_CFG: Record<Methodology, MethodCfg> = {
  simple: {
    sprintLabel: "Sprint",
    sprintShow: false,
    sprintRequired: false,
    dueSuggested: false,
    categoryProminent: false,
    statusProminent: false,
    submitLabel: "Add task",
  },
  scrum: {
    sprintLabel: "Sprint",
    sprintShow: true,
    sprintRequired: true,
    dueSuggested: true,
    categoryProminent: false,
    statusProminent: false,
    submitLabel: "Add task",
  },
  agile: {
    sprintLabel: "Iteration",
    sprintShow: true,
    sprintRequired: false,
    dueSuggested: false,
    categoryProminent: false,
    statusProminent: false,
    submitLabel: "Add task",
  },
  waterfall: {
    sprintLabel: "Phase",
    sprintShow: true,
    sprintRequired: true,
    dueSuggested: true,
    categoryProminent: true,
    statusProminent: false,
    submitLabel: "Add deliverable",
  },
  kanban: {
    sprintLabel: "Sprint",
    sprintShow: false,
    sprintRequired: false,
    dueSuggested: false,
    categoryProminent: false,
    statusProminent: true,
    submitLabel: "Add to board",
  },
};

const DEFAULT_FORM: FormState = {
  title: "",
  description: "",
  sprintId: "__none",
  status: "todo",
  assignedTo: "__unassigned",
  dueDate: "",
  category: "",
  priority: "medium",
};

const controlClassName = cn(designStandard.field.input);
const selectTriggerClassName = cn(designStandard.field.selectTrigger);

const fieldIconClassName = "size-3.5";
const labelClassName = cn(designStandard.field.label, "flex items-center gap-1.5");

function IconLabel({
  icon: Icon,
  colorClassName,
  children,
  htmlFor,
}: {
  icon: ComponentType<{ className?: string }>;
  colorClassName: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <Label htmlFor={htmlFor} className={labelClassName}>
      <Icon className={cn(fieldIconClassName, colorClassName)} />
      {children}
    </Label>
  );
}

function SprintWindowHint({
  sprintId,
  dueDate,
  sprints,
  methodology,
}: {
  sprintId: string;
  dueDate: string;
  sprints: TrackerSprint[];
  methodology: Methodology;
}) {
  if (methodology === "simple" || methodology === "kanban" || methodology === "agile") return null;
  const sprint = sprints.find((s) => s.id === sprintId);
  if (!sprint?.start_date || !sprint.end_date || !dueDate) return null;

  const due = parseISO(dueDate);
  const start = parseISO(sprint.start_date);
  const end = parseISO(sprint.end_date);
  const label = methodology === "waterfall" ? "phase" : "sprint";

  if (isBefore(due, start)) {
    return (
      <p className="mt-1 text-xs text-amber-700">
        Due date is before {label} starts. Update your timeline?
      </p>
    );
  }
  if (isAfter(due, end)) {
    return (
      <p className="mt-1 text-xs text-amber-700">
        Due date is after {label} ends. Update your timeline?
      </p>
    );
  }
  const daysLeft = differenceInDays(end, due);
  return (
    <p className="mt-1 text-xs text-emerald-700">
      {daysLeft + 1} days left in {label} to complete this.
    </p>
  );
}

export default function TaskForm({
  open,
  onOpenChange,
  groupId,
  members,
  sprints,
  currentUserId,
  canManage,
  methodology,
  defaultStatus = "todo",
  defaultSprintId = null,
  defaultDueDate = null,
  onSaved,
}: TaskFormProps) {
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM, status: defaultStatus });
  const [saving, setSaving] = useState(false);
  const cfg = METHOD_CFG[methodology];

  useEffect(() => {
    if (open) {
      setForm({
        ...DEFAULT_FORM,
        status: defaultStatus,
        sprintId: defaultSprintId && defaultSprintId !== "__backlog" ? defaultSprintId : "__none",
        dueDate: defaultDueDate ?? "",
      });
    }
  }, [defaultDueDate, defaultSprintId, defaultStatus, open]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error("Task title required", "Add a clear task name first.");
      return;
    }

    // Soft validation: sprint required in Scrum/Waterfall
    if (cfg.sprintRequired && (!form.sprintId || form.sprintId === "__none")) {
      toast({
        title: `No ${cfg.sprintLabel.toLowerCase()} selected`,
        description: `Task will go to the backlog. You can assign it to a ${cfg.sprintLabel.toLowerCase()} anytime.`,
        variant: "default",
      });
      // do NOT return — proceed to save
    }

    setSaving(true);
    try {
      const assignedTo = form.assignedTo === "__unassigned" ? null : form.assignedTo;
      const response = await fetch("/api/tracker/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          sprintId: form.sprintId === "__none" ? null : form.sprintId,
          status: form.status,
          assignedTo,
          dueDate: form.dueDate || null,
          category: form.category.trim() || null,
          priority: form.priority,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create task.");
      }

      const needsApproval = assignedTo && assignedTo !== currentUserId && !canManage;
      toast.success("Task added", needsApproval ? "Assignment marked for PM approval." : "The tracker is ready to refresh.");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error("Task not added", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submitTask}>
          <DialogHeader className="border-b border-border/70 bg-muted/30">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <DialogTitle className="">Add tracker task</DialogTitle>
                <p className={designStandard.modal.description}>Create a task for this circle and keep the work moving.</p>
              </div>
            </div>
          </DialogHeader>
          <DialogBody className="bg-card py-4">
            <div className={cn(designStandard.modal.body, "divide-y divide-border/70")}>
              <div className={cn(designTokens.spacing.field, "pb-4")}>
                <IconLabel htmlFor="task-title" icon={ListTodo} colorClassName="text-primary">
                  Title
                </IconLabel>
                <Input
                  id="task-title"
                  className={controlClassName}
                  placeholder="Name the next piece of work"
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                />
              </div>
              <div className={cn(designTokens.spacing.field, "py-4")}>
                <IconLabel htmlFor="task-description" icon={ClipboardList} colorClassName="text-emerald-600">
                  Description
                </IconLabel>
                <Textarea
                  id="task-description"
                  className={cn(controlClassName, "min-h-28 resize-y")}
                  placeholder="Add context, acceptance notes, or links"
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                />
              </div>

              {cfg.statusProminent && (
                <div className={cn(designTokens.spacing.field, "py-4")}>
                  <IconLabel icon={CheckCircle2} colorClassName={cfg.statusProminent ? "text-orange-500" : "text-emerald-600"}>
                    Status
                  </IconLabel>
                  <Select value={form.status} onValueChange={(value) => update("status", value as TaskStatus)}>
                    <SelectTrigger className={cn(selectTriggerClassName, cfg.statusProminent && "border-orange-300")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {methodology === "kanban" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Kanban has no sprint phases — tasks go straight to the board by status.
                    </p>
                  )}
                </div>
              )}

              <div className={cn(designTokens.spacing.stackMd, "py-4")}>
                {cfg.sprintShow && (
                  <div className={designTokens.spacing.field}>
                    <IconLabel icon={Layers3} colorClassName="text-violet-600">
                      {cfg.sprintLabel}
                    </IconLabel>
                    <Select value={form.sprintId} onValueChange={(value) => update("sprintId", value)}>
                      <SelectTrigger className={selectTriggerClassName}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Backlog / no phase</SelectItem>
                        {sprints
                          .filter((sprint) => sprint.id !== "__backlog")
                          .map((sprint) => (
                            <SelectItem key={sprint.id} value={sprint.id}>
                              {sprint.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {form.sprintId && form.sprintId !== "__none" && (
                      <SprintWindowHint
                        sprintId={form.sprintId}
                        dueDate={form.dueDate}
                        sprints={sprints}
                        methodology={methodology}
                      />
                    )}
                  </div>
                )}

                {!cfg.sprintShow && methodology === "kanban" && (
                  <p className="text-xs text-muted-foreground">
                    Kanban has no sprint phases — tasks go straight to the board by status.
                  </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={designTokens.spacing.field}>
                    <IconLabel icon={UserRound} colorClassName="text-sky-600">
                      Assigned member
                    </IconLabel>
                    <Select value={form.assignedTo} onValueChange={(value) => update("assignedTo", value)}>
                      <SelectTrigger className={selectTriggerClassName}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned">Unassigned</SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {getDisplayName(member)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={designTokens.spacing.field}>
                    <IconLabel htmlFor="task-due" icon={CalendarDays} colorClassName="text-amber-600">
                      Due date
                    </IconLabel>
                    <Input
                      id="task-due"
                      type="date"
                      className={controlClassName}
                      value={form.dueDate}
                      onChange={(event) => update("dueDate", event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={designTokens.spacing.field}>
                    <IconLabel
                      htmlFor="task-category"
                      icon={Tag}
                      colorClassName={cfg.categoryProminent ? "text-teal-600" : "text-orange-600"}
                    >
                      Category
                    </IconLabel>
                    <Input
                      id="task-category"
                      className={controlClassName}
                      placeholder="Research, paper, prototype..."
                      value={form.category}
                      onChange={(event) => update("category", event.target.value)}
                    />
                  </div>
                  <div className={designTokens.spacing.field}>
                    <IconLabel icon={Flag} colorClassName="text-red-600">
                      Priority
                    </IconLabel>
                    <Select value={form.priority} onValueChange={(value) => update("priority", value)}>
                      <SelectTrigger className={selectTriggerClassName}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!cfg.statusProminent && (
                  <div className={designTokens.spacing.field}>
                    <IconLabel icon={CheckCircle2} colorClassName="text-emerald-600">
                      Status
                    </IconLabel>
                    <Select value={form.status} onValueChange={(value) => update("status", value as TaskStatus)}>
                      <SelectTrigger className={selectTriggerClassName}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="bg-muted/30 px-4 pb-4 sm:px-6 sm:pb-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <ListTodo className="size-4" />
              {saving ? "Adding..." : cfg.submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
