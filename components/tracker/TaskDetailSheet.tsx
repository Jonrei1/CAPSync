"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Trash2, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import type { Profile, TaskStatus, TrackerTask } from "@/types";
import {
  formatDateLabel,
  getDisplayName,
  normalizeTaskStatus,
  STATUS_LABELS,
  STATUS_STYLES,
  TASK_STATUSES,
} from "./tracker-utils";

type TaskDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TrackerTask | null;
  members: Profile[];
  currentUserId: string | null;
  onSaved: () => void;
};

export default function TaskDetailSheet({ open, onOpenChange, task, members, currentUserId, onSaved }: TaskDetailSheetProps) {
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [assignedTo, setAssignedTo] = useState("__unassigned");
  const [dueDate, setDueDate] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [editor, setEditor] = useState<Profile | null>(null);

  useEffect(() => {
    if (task) {
      setStatus(normalizeTaskStatus(task.status));
      setAssignedTo(task.assigned_to ?? "__unassigned");
      setDueDate(task.due_date ?? "");
      setComment("");
      // Find creator from members list
      if (task.created_by && members) {
        const foundCreator = members.find((m) => m.id === task.created_by);
        setCreator(foundCreator ?? null);
      }
      // Find editor from members list
      if (task.edited_by && members) {
        const foundEditor = members.find((m) => m.id === task.edited_by);
        setEditor(foundEditor ?? null);
      }
    }
  }, [task, members]);

  if (!task) {
    return null;
  }

  async function saveTask() {
    if (!task) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/tracker/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          assignedTo: assignedTo === "__unassigned" ? null : assignedTo,
          dueDate: dueDate || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update task.");
      }

      toast.success("Task updated");
      onSaved();
    } catch (error) {
      toast.error("Task not updated", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask() {
    if (!task) {
      return;
    }

    if (!confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/tracker/tasks/${task.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete task.");
      }

      toast.success("Task deleted");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error("Task not deleted", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function addComment() {
    if (!task || !comment.trim()) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/tracker/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to add comment.");
      }

      setComment("");
      toast.success("Comment added");
      onSaved();
    } catch (error) {
      toast.error("Comment not added", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-2">
            <div>
              <DialogTitle>{task.title}</DialogTitle>
              <p className="text-xs text-muted-foreground">{task.description || "No description yet."}</p>
            </div>
          </div>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4">
            {/* Creator and Edit Info */}
            <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Created by</div>
                <div className="mt-1">{creator ? getDisplayName(creator) : "Unknown"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Edited by</div>
                <div className="mt-1">{editor ? getDisplayName(editor) : creator ? getDisplayName(creator) : "Unknown"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Priority</div>
                <div className="mt-1 capitalize">{task.priority}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Current status</div>
                <Badge variant="outline" className={STATUS_STYLES[normalizeTaskStatus(task.status)]}>
                  {STATUS_LABELS[normalizeTaskStatus(task.status)]}
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {STATUS_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Assignee</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="w-full">
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
            </div>

            {/* Due Date Picker */}
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-2">
                <Calendar className="size-4" />
                Due Date
              </Label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="size-4" />
                Comments
              </div>
              <div className="space-y-2">
                {task.comments?.length ? (
                  task.comments.map((item) => (
                    <div key={item.id} className="rounded-lg border bg-card p-3">
                      <div className="text-xs font-medium">{getDisplayName(item.author)}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.body}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">No comments yet.</div>
                )}
              </div>
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add a short update, blocker, or adviser note..."
              />
              <Button variant="outline" onClick={addComment} disabled={saving || deleting || !comment.trim()}>
                Add comment
              </Button>
            </div>
          </div>
        </DialogBody>
        <DialogFooter className="px-6 pb-5 flex items-center justify-end gap-3">
          {currentUserId === task.created_by ? (
            <Button
              variant="destructive"
              onClick={deleteTask}
              disabled={deleting || saving}
            >
              {deleting ? "Deleting..." : "Delete task"}
            </Button>
          ) : null}
          <Button onClick={saveTask} disabled={saving || deleting}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
