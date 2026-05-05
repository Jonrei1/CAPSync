"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_INDEX: Record<(typeof DAY_KEYS)[number], number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getWeekStart(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function dayKeyToDate(day: string, weekStart: Date) {
  const normalized = day.slice(0, 3).toLowerCase() as (typeof DAY_KEYS)[number];
  const next = new Date(weekStart);
  next.setDate(next.getDate() + (DAY_INDEX[normalized] ?? 0));
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

function dateToInput(date: Date) {
  const today = new Date(date);
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
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

type AddMeetingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: CalendarMember[];
  weekStart: Date;
  prefillDay?: string;
  prefillStart?: number;
  prefillEnd?: number;
  creatorName?: string;
};

export default function AddMeetingDialog({
  open,
  onOpenChange,
  groupId,
  members,
  weekStart,
  prefillDay,
  prefillStart,
  prefillEnd,
  creatorName = "Unknown",
}: AddMeetingDialogProps) {
  const router = useRouter();

  // Window boundaries — clamp user input to these
  const windowMin = prefillStart ?? 0;
  const windowMax = prefillEnd ?? 23.99;

  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState(() =>
    prefillDay ? dayKeyToDate(prefillDay, weekStart) : dateToInput(weekStart),
  );
  const [startTime, setStartTime] = useState(() => hourToInput(prefillStart ?? 9));
  const [endTime, setEndTime] = useState(() => hourToInput(prefillEnd ?? 10));
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() =>
    members.map((m) => m.id),
  );
  const [saving, setSaving] = useState(false);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setSelectedDate(
      prefillDay ? dayKeyToDate(prefillDay, weekStart) : dateToInput(weekStart),
    );
    setStartTime(hourToInput(prefillStart ?? 9));
    setEndTime(
      hourToInput(prefillEnd ?? Math.max((prefillStart ?? 9) + 1, 10)),
    );
    setLocation("");
    setDescription("");
    setSelectedMemberIds(members.map((m) => m.id));
    setSaving(false);
  }, [members, open, prefillDay, prefillEnd, prefillStart, weekStart]);

  function handleStartChange(value: string) {
    const h = timeInputToHour(value);
    // Clamp to window boundaries
    const clamped = Math.max(windowMin, Math.min(h, windowMax - 0.25));
    const clampedStr = hourToInput(clamped);
    setStartTime(clampedStr);
    // Ensure end is after start and within window
    const currentEnd = timeInputToHour(endTime);
    if (currentEnd <= clamped) {
      setEndTime(hourToInput(Math.min(clamped + 0.5, windowMax)));
    }
  }

  function handleEndChange(value: string) {
    const h = timeInputToHour(value);
    const clamped = Math.max(windowMin + 0.25, Math.min(h, windowMax));
    setEndTime(hourToInput(clamped));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a meeting title");
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Something went wrong — please try again");
      setSaving(false);
      return;
    }

    const startDecimal = timeInputToHour(startTime);
    const endDecimal = timeInputToHour(endTime);

    if (!(endDecimal > startDecimal)) {
      toast.error("End time must be after start time");
      setSaving(false);
      return;
    }

    // Fetch creator's display name for storage
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const resolvedName =
      profileData?.full_name?.trim() ||
      profileData?.email?.split("@")[0] ||
      creatorName;

    // Verify user is a group member before attempting insert
    const { data: membership, error: membershipError } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("member_id", user.id)
      .single();

    if (membershipError || !membership) {
      console.error("[AddMeeting] user is not a member of this group", {
        groupId,
        userId: user.id,
        membershipError,
      });
      toast.error("You are not a member of this group");
      setSaving(false);
      return;
    }

    const insertData = {
      group_id: groupId,
      member_id: user.id,
      created_by_name: resolvedName,
      day: selectedDate,
      start_hour: startDecimal,
      end_hour: endDecimal,
      label: title.trim(),
      sub: location.trim() || "",
      description: description.trim() || "",
      type: "meeting",
    };

    console.log("[AddMeeting] inserting with data:", insertData);

    const { data: newSchedule, error: scheduleError } = await supabase
      .from("schedules")
      .insert(insertData)
      .select()
      .single();

    if (scheduleError || !newSchedule) {
      console.error("[AddMeeting] insert error:", {
        scheduleError,
        errorCode: scheduleError?.code,
        errorMessage: scheduleError?.message,
        errorDetails: scheduleError?.details,
        insertData,
      });
      
      let errorMsg = "Failed to create meeting. Please check your permissions and try again.";
      if (scheduleError?.message) {
        errorMsg = scheduleError.message;
      } else if (scheduleError?.code === "23503") {
        errorMsg = "Invalid group or user ID. Please refresh and try again.";
      } else if (scheduleError?.code === "42501") {
        errorMsg = "Permission denied. Make sure you are a member of this group.";
      }
      
      toast.error(errorMsg);
      setSaving(false);
      return;
    }

    // Insert invites for all selected members except the creator
    const inviteRows = selectedMemberIds
      .filter((id) => id !== user.id)
      .map((memberId) => ({
        schedule_id: newSchedule.id,
        member_id: memberId,
        status: "pending",
        read_at: null, // unread
      }));

    if (inviteRows.length) {
      const { error: inviteError } = await supabase
        .from("schedule_invites")
        .insert(inviteRows);

      if (inviteError) {
        console.error("[AddMeeting] invite error:", inviteError);
        // Non-fatal: meeting was created, invites failed
        toast.error("Meeting created but failed to notify some members");
        onOpenChange(false);
        router.refresh();
        setSaving(false);
        return;
      }
    }

    toast.success("Meeting added");
    onOpenChange(false);
    router.refresh();
    setSaving(false);
  }

  const minTimeStr = hourToInput(windowMin);
  const maxTimeStr = hourToInput(windowMax);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Add meeting
          </div>
          <DialogTitle>Create a meeting</DialogTitle>
          {prefillStart !== undefined && prefillEnd !== undefined && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Free window: {minTimeStr} – {maxTimeStr} · Times are constrained to this range.
            </p>
          )}
        </DialogHeader>

        <DialogBody>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="meeting-title">Meeting title</Label>
              <Input
                id="meeting-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Project sync"
                required
              />
            </div>

            {/* Date + Location */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="meeting-date">Date</Label>
                <Input
                  id="meeting-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (!prefillDay) setSelectedDate(e.target.value);
                  }}
                  disabled={Boolean(prefillDay)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meeting-location">Location / link</Label>
                <Input
                  id="meeting-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Room 1005 or meet.google.com/..."
                />
              </div>
            </div>

            {/* Start + End times (clamped to free window) */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="meeting-start">
                  Start time
                  {prefillStart !== undefined && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      (min {minTimeStr})
                    </span>
                  )}
                </Label>
                <Input
                  id="meeting-start"
                  type="time"
                  value={startTime}
                  min={minTimeStr}
                  max={maxTimeStr}
                  onChange={(e) => handleStartChange(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meeting-end">
                  End time
                  {prefillEnd !== undefined && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      (max {maxTimeStr})
                    </span>
                  )}
                </Label>
                <Input
                  id="meeting-end"
                  type="time"
                  value={endTime}
                  min={minTimeStr}
                  max={maxTimeStr}
                  onChange={(e) => handleEndChange(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="meeting-description">Description</Label>
              <Textarea
                id="meeting-description"
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
                {saving ? "Saving..." : "Add meeting"}
              </Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
