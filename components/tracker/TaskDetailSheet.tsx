"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Trash2, Calendar, AlertTriangle, Edit2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import type { Profile, TaskStatus, TrackerComment, TrackerTask } from "@/types";
import {
  formatDateLabel,
  getDisplayName,
  normalizeTaskStatus,
  STATUS_LABELS,
  STATUS_STYLES,
  TASK_STATUSES,
} from "./tracker-utils";
import { useDesignStandard } from "@/components/ui/design-standard";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [editor, setEditor] = useState<Profile | null>(null);
  const [commentsState, setCommentsState] = useState<TrackerComment[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const [commentSavingId, setCommentSavingId] = useState<string | null>(null);
  const lastTaskIdRef = useRef<string | null>(null);
  const design = useDesignStandard();

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
      // Only reset comments/editor state when switching to a different task.
      if (lastTaskIdRef.current !== task.id) {
        setCommentsState(task.comments ?? []);
        setEditingCommentId(null);
        setEditingText("");
        setPendingDeleteCommentId(null);
        setCommentSavingId(null);
        lastTaskIdRef.current = task.id;
      }
    }
  }, [task, members]);

  if (!task) {
    return null;
  }

  const assigneeName = task.assigned_to ? (members.find((m) => m.id === task.assigned_to)?.full_name ?? task.assigned_to) : "Unassigned";

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
      onOpenChange(false);
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
    // open confirmation modal instead of browser-native confirm
    setShowDeleteConfirm(true);
  }

  async function performDelete() {
    if (!task) return;

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
      setShowDeleteConfirm(false);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error("Task not deleted", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  type CommentResponse = {
    error?: string;
    comment?: TrackerComment;
  } & Partial<TrackerComment>;

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
      const payload = (await response.json().catch(() => ({}))) as CommentResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to add comment.");
      }

      // Determine created comment from response or build a fallback so it appears immediately
      const created = payload.comment ?? payload;
      if (created && (created.id || created.body)) {
        const author = created.author ?? (members.find((m) => m.id === currentUserId) ?? null);
        const normalized = {
          id: created.id ?? `temp-${Date.now()}`,
          body: created.body ?? comment.trim(),
          author,
          task_id: task.id,
          author_id: currentUserId,
          created_at: new Date().toISOString(),
        };
        setCommentsState((prev) => [...prev, normalized as TrackerComment]);
      } else {
        const author = members.find((m) => m.id === currentUserId) ?? null;
        const fallback = { 
          id: `temp-${Date.now()}`, 
          body: comment.trim(), 
          author,
          task_id: task.id,
          author_id: currentUserId,
          created_at: new Date().toISOString(),
        };
        setCommentsState((prev) => [...prev, fallback as TrackerComment]);
      }

      setComment("");
      toast.success("Comment added");
    } catch (error) {
      toast.error("Comment not added", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function startEditComment(comment: TrackerComment) {
    setEditingCommentId(comment.id);
    setEditingText(comment.body ?? "");
  }

  function cancelEdit() {
    setEditingCommentId(null);
    setEditingText("");
  }

  async function saveEditedComment(commentId: string) {
    if (!task) return;
    setCommentSavingId(commentId);
    try {
      const response = await fetch(`/api/tracker/tasks/${task.id}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editingText }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to edit comment.");

      setCommentsState((prev) => prev.map((c) => (c.id === commentId ? { ...c, body: editingText } : c)));
      toast.success("Comment updated");
      cancelEdit();
    } catch (err) {
      toast.error("Comment not updated", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setCommentSavingId(null);
    }
  }

  async function confirmDeleteComment(commentId: string) {
    if (!task) return;
    setCommentSavingId(commentId);
    try {
      const response = await fetch(`/api/tracker/tasks/${task.id}/comments/${commentId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to delete comment.");

      setCommentsState((prev) => prev.filter((c) => c.id !== commentId));
      toast.success("Comment deleted");
      setPendingDeleteCommentId(null);
    } catch (err) {
      toast.error("Comment not deleted", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setCommentSavingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen">
          <DialogHeader className="px-3 pt-5 pb-3 pr-12 sm:px-7">
          <div className="flex flex-col gap-2">
            <div>
              <DialogTitle>{task.title}</DialogTitle>
              <p className="text-xs text-muted-foreground">{task.description || "No description yet."}</p>
            </div>
          </div>
          </DialogHeader>
          <DialogBody className="space-y-4 px-3 sm:px-8">
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
                {commentsState.length ? (
                  commentsState.map((item) => {
                    const isAuthor = !!(item.author && item.author.id && currentUserId && item.author.id === currentUserId);
                    return (
                      <div key={item.id} className={`${design.cards.panel} p-3`}> 
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-medium">{getDisplayName(item.author)}</div>
                            {editingCommentId === item.id ? null : (
                              <div className="mt-1 text-sm text-muted-foreground wrap-break-word">{item.body}</div>
                            )}
                          </div>
                          {isAuthor ? (
                            <div className="flex items-start gap-2">
                              {editingCommentId === item.id ? (
                                <button type="button" onClick={cancelEdit} className="rounded px-2 py-1 text-sm text-muted-foreground hover:text-foreground">
                                  <X className="size-4" />
                                </button>
                              ) : (
                                <button type="button" onClick={() => startEditComment(item)} className="rounded px-2 py-1 text-sm text-muted-foreground hover:text-foreground">
                                  <Edit2 className="size-4" />
                                </button>
                              )}
                              <div>
                                {pendingDeleteCommentId === item.id ? (
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => setPendingDeleteCommentId(null)} disabled={commentSavingId === item.id}>Cancel</Button>
                                    <Button size="sm" variant="destructive" onClick={() => confirmDeleteComment(item.id)} disabled={commentSavingId === item.id}>{commentSavingId === item.id ? "Deleting..." : "Delete"}</Button>
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => setPendingDeleteCommentId(item.id)} className="rounded px-2 py-1 text-sm text-muted-foreground hover:text-foreground">
                                    <Trash2 className="size-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {editingCommentId === item.id ? (
                          <div className="mt-3">
                            <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} />
                            <div className="mt-2 flex gap-2 justify-end">
                              <Button variant="outline" size="sm" onClick={cancelEdit} disabled={commentSavingId === item.id}>Cancel</Button>
                              <Button size="default" onClick={() => saveEditedComment(item.id)} disabled={commentSavingId === item.id}>{commentSavingId === item.id ? "Saving..." : "Save"}</Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
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
        <DialogFooter className={design.modal.actions}>
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
        {/* Delete confirmation modal with task details (uniform with meeting modal) */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete task?</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-700">Permanent action</p>
                    <p className="mt-1 text-sm text-red-900">
                      This task will be deleted for everyone and may notify members. This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-foreground">{task.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Task details</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-background/80 p-3">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Due</div>
                      <p className="mt-1 text-sm font-medium text-foreground">{formatDateLabel(task.due_date)}</p>
                    </div>

                    <div className="rounded-xl bg-background/80 p-3">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</div>
                      <p className="mt-1 text-sm font-medium text-foreground">{STATUS_LABELS[normalizeTaskStatus(task.status)]}</p>
                    </div>

                    <div className="rounded-xl bg-background/80 p-3">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</div>
                      <p className="mt-1 text-sm font-medium text-foreground">{task.category ?? "General"}</p>
                    </div>

                    <div className="rounded-xl bg-background/80 p-3">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Assignee</div>
                      <p className="mt-1 text-sm font-medium text-foreground">{assigneeName}</p>
                    </div>
                  </div>

                  {task.description?.trim() ? (
                    <div className="mt-4 rounded-xl bg-background/80 p-3 sm:col-span-2">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{task.description}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </DialogBody>
            <div className="flex justify-end gap-2 p-5 pt-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={performDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
