"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCircle, type Group } from "@/contexts/CircleContext";
import supabase from "@/lib/supabaseClient";

type JoinCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingGroupCount?: number;
  onCompleted?: () => void;
  initialTab?: "join" | "create";
};

type TabMode = "join" | "create";

const COLOR_POOL = ["#4f46e5", "#16a34a", "#ea580c", "#9333ea", "#2563eb", "#ca8a04"];

export default function JoinCreateDialog({
  open,
  onOpenChange,
  existingGroupCount = 0,
  onCompleted,
  initialTab = "join",
}: JoinCreateDialogProps) {
  const { setActiveCircle } = useCircle();
  const [tab, setTab] = useState<TabMode>(initialTab);
  const [inviteCode, setInviteCode] = useState("");
  const [circleName, setCircleName] = useState("");
  const [subject, setSubject] = useState("");
  const [methodology, setMethodology] = useState("Scrum (2-week sprints)");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Update tab when initialTab or open changes
  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  const buttonLabel = useMemo(() => (tab === "join" ? "Join circle" : "Create circle"), [tab]);

  function resetForm() {
    setInviteCode("");
    setCircleName("");
    setSubject("");
    setMethodology("Scrum (2-week sprints)");
    setError("");
    setLoading(false);
    setTab(initialTab);
  }

  function closeDialog() {
    onOpenChange(false);
    resetForm();
  }

  async function handleJoinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const normalizedCode = inviteCode.trim().toUpperCase();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
      setError("You must be signed in to join a circle.");
      setLoading(false);
      return;
    }

    const { data: groupData, error: groupError } = await supabase
      .from("groups")
      .select("*")
      .eq("invite_code", normalizedCode)
      .single();

    if (groupError || !groupData) {
      setError("Invalid invite code");
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from("group_members").insert({
      group_id: groupData.id,
      member_id: userId,
      role: "member",
    });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    setActiveCircle(groupData as Group);
    onCompleted?.();
    closeDialog();
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
      setError("You must be signed in to create a circle.");
      setLoading(false);
      return;
    }

    const invite_code = Math.random().toString(36).slice(2, 10).toUpperCase();
    const color = COLOR_POOL[existingGroupCount % COLOR_POOL.length];

    const { data: newGroup, error: createError } = await supabase
      .from("groups")
      .insert({
        name: circleName,
        subject,
        methodology,
        invite_code,
        color,
        created_by: userId,
      })
      .select("*")
      .single();

    if (createError || !newGroup) {
      setError(createError?.message ?? "Failed to create circle.");
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from("group_members").insert({
      group_id: newGroup.id,
      member_id: userId,
      role: "pm",
    });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    setActiveCircle(newGroup as Group);
    onCompleted?.();
    closeDialog();
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      <div className="w-full max-w-110 rounded-xl border bg-card shadow-xl">
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-[15px] font-semibold">Join or create a circle</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            A circle is your class or project group. You can switch between circles anytime.
          </p>
        </div>

        <div className="px-6 pb-4">
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-md border bg-muted p-1">
            <Button
              type="button"
              size="sm"
              variant={tab === "join" ? "outline" : "ghost"}
              className="h-7 justify-center text-xs cursor-pointer"
              onClick={() => {
                setTab("join");
                setError("");
              }}
            >
              Join
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "create" ? "outline" : "ghost"}
              className="h-7 justify-center text-xs cursor-pointer"
              onClick={() => {
                setTab("create");
                setError("");
              }}
            >
              Create
            </Button>
          </div>

          {tab === "join" ? (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="inviteCode" className="text-xs font-medium">
                  Invite code
                </label>
                <Input
                  id="inviteCode"
                  value={inviteCode}
                  maxLength={8}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  placeholder="e.g. AB3X9K2P"
                  className="font-mono tracking-widest uppercase"
                  required
                  disabled={loading}
                />
                <p className="text-[11px] text-muted-foreground">Ask your PM for the 8-character code</p>
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={loading} className="cursor-pointer">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="cursor-pointer">
                  {loading ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" />
                      Joining...
                    </span>
                  ) : (
                    buttonLabel
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="circleName" className="text-xs font-medium">
                  Circle name
                </label>
                <Input
                  id="circleName"
                  value={circleName}
                  onChange={(event) => setCircleName(event.target.value)}
                  placeholder="e.g. Thesis Group A"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="subject" className="text-xs font-medium">
                  Subject / course
                </label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="e.g. BSIT - Thesis 2"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="methodology" className="text-xs font-medium">
                  Methodology
                </label>
                <select
                  id="methodology"
                  value={methodology}
                  onChange={(event) => setMethodology(event.target.value)}
                  className="h-9 w-full cursor-pointer rounded-lg border bg-background px-3 text-sm"
                  disabled={loading}
                >
                  <option>Scrum (2-week sprints)</option>
                  <option>Agile</option>
                  <option>Waterfall (phases)</option>
                  <option>Kanban</option>
                </select>
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="outline" onClick={closeDialog} disabled={loading} className="cursor-pointer">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="cursor-pointer">
                  {loading ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    buttonLabel
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
