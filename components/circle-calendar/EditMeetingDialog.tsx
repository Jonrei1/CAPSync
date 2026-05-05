"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Clock3, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import supabase from "@/lib/supabaseClient";
import type { CalendarMember } from "@/types";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function hourToInput(value?: number) {
  if (value === undefined || Number.isNaN(value)) return "09:00";
  const clamped = Math.max(0, Math.min(value, 23.99));
  const hours = Math.floor(clamped);
  const minutes = Math.round((clamped - hours) * 60);
  return `${pad(hours)}:${pad(minutes)}`;
}

function timeInputToHour(value: string) {
  const [hoursPart = "0", minutesPart = "0"] = value.split(":");
  const hours = Number.parseInt(hoursPart, 10);
  const minutes = Number.parseInt(minutesPart, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours + minutes / 60;
}

function formatReadableDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDuration(startValue: string, endValue: string) {
  const duration = Math.max(0, timeInputToHour(endValue) - timeInputToHour(startValue));
  const hours = Math.floor(duration);
  const minutes = Math.round((duration - hours) * 60);

  if (hours === 0 && minutes === 0) {
    return "0 min";
  }

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }

  return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min`;
}

type EditMeetingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: CalendarMember[];
  scheduleId: string | null;
  mode: "edit" | "delete";
};

type ScheduleData = {
  id: string;
  label: string;
  day: string;
  start_hour: number;
  end_hour: number;
  sub: string;
  description: string;
  member_id: string;
  created_by_name: string;
  last_edited_by_name?: string;
};

export default function EditMeetingDialog({
  open,
  onOpenChange,
  groupId,
  members,
  scheduleId,
  mode,
}: EditMeetingDialogProps) {
  const router = useRouter();
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  useEffect(() => {
    if (!open || !scheduleId) return;
    setLoading(true);

    async function loadSchedule() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        setUser(userData.user);

        const { data, error } = await supabase
          .from("schedules")
          .select("*")
          .eq("id", scheduleId)
          .single();

        if (error || !data) {
          toast.error("Failed to load schedule details");
          onOpenChange(false);
          return;
        }

        setSchedule(data as ScheduleData);
        setTitle(data.label || "");
        setSelectedDate(data.day || "");
        setStartTime(hourToInput(data.start_hour));
        setEndTime(hourToInput(data.end_hour));
        setLocation(data.sub || "");
        setDescription(data.description || "");

        // Load invitees
        const { data: invites } = await supabase
          .from("schedule_invites")
          .select("member_id")
          .eq("schedule_id", scheduleId);

        const invitedIds = invites?.map((inv) => inv.member_id) || [];
        setSelectedMemberIds(invitedIds);
      } catch (err) {
        console.error("Error loading schedule:", err);
        toast.error("Failed to load schedule");
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    }

    void loadSchedule();
  }, [open, scheduleId, onOpenChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a meeting title");
      return;
    }

    if (!scheduleId) {
      toast.error("Schedule ID not found");
      return;
    }

    setSaving(true);

    const startDecimal = timeInputToHour(startTime);
    const endDecimal = timeInputToHour(endTime);

    if (!(endDecimal > startDecimal)) {
      toast.error("End time must be after start time");
      setSaving(false);
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      
      // Get current user profile name for "Edited by" indication
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      const { error } = await supabase
        .from("schedules")
        .update({
          label: title.trim(),
          day: selectedDate,
          start_hour: startDecimal,
          end_hour: endDecimal,
          sub: location.trim() || "",
          last_edited_by_name: profile?.full_name || userData.user?.email || "Someone",
        })
        .eq("id", scheduleId);

      if (error) {
        console.error("Update error:", error);
        toast.error(
          error?.message || "Failed to update meeting. Please check your permissions and try again."
        );
        setSaving(false);
        return;
      }

      // Update invites
      await supabase
        .from("schedule_invites")
        .delete()
        .eq("schedule_id", scheduleId);

      const { data: currentUser } = await supabase.auth.getUser();
      const inviteRows = selectedMemberIds
        .filter((id) => id !== currentUser.user?.id)
        .map((memberId) => ({
          schedule_id: scheduleId,
          member_id: memberId,
          status: "pending",
          read_at: null,
        }));

      if (inviteRows.length > 0) {
        await supabase.from("schedule_invites").insert(inviteRows);
      }

      toast.success("Meeting updated");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      console.error("Error:", err);
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!scheduleId) return;

    if (!window.confirm("Are you sure you want to delete this meeting?")) {
      return;
    }

    setDeleting(true);

    try {
      // Delete invites first
      await supabase
        .from("schedule_invites")
        .delete()
        .eq("schedule_id", scheduleId);

      // Delete schedule
      const { error } = await supabase
        .from("schedules")
        .delete()
        .eq("id", scheduleId);

      if (error) {
        console.error("Delete error:", error);
        toast.error(
          error?.message || "Failed to delete meeting. Please check your permissions and try again."
        );
        setDeleting(false);
        return;
      }

      toast.success("Meeting deleted");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      console.error("Error deleting:", err);
      toast.error("Something went wrong");
      setDeleting(false);
    }
  }

  const isDeleteMode = mode === "delete";
  const meetingDuration = formatDuration(startTime, endTime);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {isDeleteMode ? "Delete meeting" : "Edit meeting"}
          </div>
          <DialogTitle>{isDeleteMode ? "Delete this meeting?" : "Edit meeting"}</DialogTitle>
        </DialogHeader>

        {isDeleteMode ? (
          <DialogBody>
            <div className="space-y-5 pb-1">
              <div className="flex items-start gap-4 rounded-2xl border border-red-200/80 bg-red-50/70 p-4 sm:p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                  <AlertTriangle className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-red-700">Permanent action</p>
                  <p className="mt-1 text-sm leading-6 text-red-900/90">
                    This meeting will be deleted for everyone and all attendees will be notified.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Meeting details</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                    <Trash2 className="size-4" />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-background/80 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      Date
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{formatReadableDate(selectedDate)}</p>
                  </div>

                  <div className="rounded-xl bg-background/80 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Clock3 className="size-3.5" />
                      Time
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {startTime} - {endTime}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Duration: {meetingDuration}</p>
                  </div>

                  <div className="rounded-xl bg-background/80 p-3 sm:col-span-2">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <MapPin className="size-3.5" />
                      Location / link
                    </div>
                    <p className="mt-1 wrap-break-word text-sm font-medium text-foreground">
                      {location.trim() || "No location added"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogBody>
        ) : (
          <DialogBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-meeting-title">Meeting title</Label>
                <Input
                  id="edit-meeting-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Project sync"
                  required
                />
              </div>

              {/* Date + Location */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-meeting-date">Date</Label>
                  <Input
                    id="edit-meeting-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-meeting-location">Location / link</Label>
                  <Input
                    id="edit-meeting-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Room 1005 or meet.google.com/..."
                  />
                </div>
              </div>

              {/* Start + End times */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-meeting-start">Start time</Label>
                  <Input
                    id="edit-meeting-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-meeting-end">End time</Label>
                  <Input
                    id="edit-meeting-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-meeting-description">Description</Label>
                <Textarea
                  id="edit-meeting-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add agenda, notes, or agenda link"
                />
              </div>

              {/* Invite members */}
              <div className="space-y-2">
                <Label>Invite members</Label>
                <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 md:grid-cols-2">
                  {members.map((member) => {
                    const checked = selectedMemberIds.includes(member.id);
                    return (
                      <label
                        key={member.id}
                        className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:border-border/60 hover:bg-background"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            setSelectedMemberIds((current) => {
                              if (next) {
                                return current.includes(member.id)
                                  ? current
                                  : [...current, member.id];
                              }
                              return current.filter((id) => id !== member.id);
                            });
                          }}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {memberMap.get(member.id)?.name ?? member.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {member.role}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogBody>
        )}

        {isDeleteMode && (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={deleting}
            >
              Keep meeting
            </Button>
            {schedule && user && schedule.member_id === user.id ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete meeting"}
              </Button>
            ) : (
              <div className="text-[11px] text-muted-foreground italic self-center">
                Only the creator can delete this meeting.
              </div>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
