"use client";

import { useEffect, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, ClipboardList, Flag, Layers3, ListTodo, Sparkles, Tag, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { designStandard, designTokens } from "@/components/ui/design-standard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { Profile, TaskStatus, TrackerSprint } from "@/types";
import { getDisplayName, STATUS_LABELS, TASK_STATUSES } from "./tracker-utils";

type TaskFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: Profile[];
  sprints: TrackerSprint[];
  currentUserId: string;
  canManage: boolean;
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

const fieldShellClassName = cn(
  "rounded-xl border border-border/70 bg-background p-3 shadow-xs",
  designTokens.spacing.stackSm,
);

const controlClassName = cn(designStandard.field.input, "bg-card shadow-xs");
const selectTriggerClassName = cn(designStandard.field.selectTrigger, "bg-card shadow-xs");

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

export default function TaskForm({
  open,
  onOpenChange,
  groupId,
  members,
  sprints,
  currentUserId,
  canManage,
  defaultStatus = "todo",
  defaultSprintId = null,
  defaultDueDate = null,
  onSaved,
}: TaskFormProps) {
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM, status: defaultStatus });
  const [saving, setSaving] = useState(false);

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
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <ClipboardList className="size-5" />
              </div>
              <div className="min-w-0">
                <div className={designStandard.modal.badge}>
                  <Sparkles className="size-3 text-amber-600" />
                  Tracker task
                </div>
                <DialogTitle className="mt-2">Add tracker task</DialogTitle>
                <p className={designStandard.modal.description}>Create a task for this circle and keep the work moving.</p>
              </div>
            </div>
          </DialogHeader>
          <DialogBody className="bg-card py-4">
            <div className="grid gap-3">
              <div className={fieldShellClassName}>
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
              <div className={fieldShellClassName}>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={fieldShellClassName}>
                  <IconLabel icon={Layers3} colorClassName="text-violet-600">
                    Sprint / phase
                  </IconLabel>
                  <Select value={form.sprintId} onValueChange={(value) => update("sprintId", value)}>
                    <SelectTrigger className={selectTriggerClassName}>
                      <span className="flex min-w-0 items-center gap-2">
                        <Layers3 className="size-4 text-violet-600" />
                        <SelectValue />
                      </span>
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
                </div>
                <div className={fieldShellClassName}>
                  <IconLabel icon={CheckCircle2} colorClassName="text-emerald-600">
                    Status
                  </IconLabel>
                  <Select value={form.status} onValueChange={(value) => update("status", value as TaskStatus)}>
                    <SelectTrigger className={selectTriggerClassName}>
                      <span className="flex min-w-0 items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        <SelectValue />
                      </span>
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
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={fieldShellClassName}>
                  <IconLabel icon={UserRound} colorClassName="text-sky-600">
                    Assigned member
                  </IconLabel>
                  <Select value={form.assignedTo} onValueChange={(value) => update("assignedTo", value)}>
                    <SelectTrigger className={selectTriggerClassName}>
                      <span className="flex min-w-0 items-center gap-2">
                        <UserRound className="size-4 text-sky-600" />
                        <SelectValue />
                      </span>
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
                <div className={fieldShellClassName}>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={fieldShellClassName}>
                  <IconLabel htmlFor="task-category" icon={Tag} colorClassName="text-orange-600">
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
                <div className={fieldShellClassName}>
                  <IconLabel icon={Flag} colorClassName="text-red-600">
                    Priority
                  </IconLabel>
                  <Select value={form.priority} onValueChange={(value) => update("priority", value)}>
                    <SelectTrigger className={selectTriggerClassName}>
                      <span className="flex min-w-0 items-center gap-2">
                        <Flag className="size-4 text-red-600" />
                        <SelectValue />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="bg-muted/30 px-4 pb-4 sm:px-6 sm:pb-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <ListTodo className="size-4" />
              {saving ? "Adding..." : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
