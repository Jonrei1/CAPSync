"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
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

const METHODOLOGY_OPTIONS = [
  {
    value: "Scrum (2-week sprints)",
    title: "Scrum",
    summary: "Fixed 2-week sprint cycles with clear goals and checkpoints.",
    vibe: "Structured",
    fit: "Best for teams that want structure, regular adviser updates, and predictable delivery.",
    howItWorks:
      "Create a sprint backlog, set daily priorities, and review outputs at sprint end before planning the next cycle.",
  },
  {
    value: "Agile",
    title: "Agile",
    summary: "Iterative planning that adapts quickly to change.",
    vibe: "Adaptive",
    fit: "Best for teams exploring uncertain scope and needing flexibility each week.",
    howItWorks:
      "Break the capstone into small increments, test ideas early, and continuously refine based on feedback.",
  },
  {
    value: "Waterfall (phases)",
    title: "Waterfall",
    summary: "Sequential phase-by-phase delivery with sign-offs.",
    vibe: "Phase-based",
    fit: "Best for teams with fixed requirements, strict approval flow, or adviser-driven milestones.",
    howItWorks:
      "Finish one phase fully before starting the next, with clear sign-offs at each milestone.",
  },
  {
    value: "Kanban",
    title: "Kanban",
    summary: "Continuous task flow with work-in-progress limits.",
    vibe: "Flow-based",
    fit: "Best for teams with parallel tasks and uneven workloads across members.",
    howItWorks:
      "Track work across columns such as To Do, In Progress, and Done while limiting work in progress.",
  },
] as const;

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
  const [methodology, setMethodology] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Update tab when initialTab or open changes
  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  const buttonLabel = useMemo(() => (tab === "join" ? "Join circle" : "Create circle"), [tab]);
  const selectedMethodology = useMemo(
    () => METHODOLOGY_OPTIONS.find((option) => option.value === methodology),
    [methodology]
  );

  function resetForm() {
    setInviteCode("");
    setCircleName("");
    setSubject("");
    setMethodology("");
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
        methodology: methodology || null,
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
      className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto bg-black/55 px-3 py-4 backdrop-blur-[2px] sm:items-center sm:px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
        <button
          type="button"
          onClick={closeDialog}
          disabled={loading}
          className="absolute top-3 right-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </button>

        <div className="px-4 pt-5 pb-3 pr-14 sm:px-6">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="size-3" />
            Capstone Team Setup
          </div>
          <h2 className="text-[16px] font-semibold tracking-tight">Join or create a circle</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            A circle is your class or project group. You can switch between circles anytime.
          </p>
        </div>

        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto px-4 pb-4 sm:px-6">
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
                <label className="text-xs font-medium">
                  Methodology <span className="text-muted-foreground">(optional)</span>
                </label>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Pick one planning style for your capstone workflow. You can skip this now and decide with your team
                  after your first meeting.
                </p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMethodology("")}
                    disabled={loading}
                    className={[
                      "group w-full rounded-xl border px-3 py-3 text-left transition-colors md:col-span-2",
                      methodology === ""
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/70 bg-background hover:bg-muted/50",
                      loading ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                    ].join(" ")}
                    aria-pressed={methodology === ""}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">Decide later as a team</div>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          Start immediately and choose a methodology when everyone is aligned.
                        </p>
                      </div>
                      {methodology === "" ? <CheckCircle2 className="mt-0.5 size-4 text-primary" /> : null}
                    </div>
                  </button>

                  {METHODOLOGY_OPTIONS.map((option) => {
                    const selected = methodology === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setMethodology(option.value)}
                        disabled={loading}
                        className={[
                          "group w-full rounded-xl border px-3 py-3 text-left transition-all",
                          selected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border/70 bg-background hover:-translate-y-0.5 hover:bg-muted/40",
                          loading ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                        ].join(" ")}
                        aria-pressed={selected}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">{option.title}</div>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{option.summary}</p>
                          </div>
                          {selected ? <CheckCircle2 className="mt-0.5 size-4 text-primary" /> : null}
                        </div>
                        <div className="mt-2 inline-flex rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {option.vibe}
                        </div>
                      </button>
                    );
                  })}

                  <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-3 md:col-span-2">
                    {selectedMethodology ? (
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Why {selectedMethodology.title} for your team
                        </div>
                        <p className="text-[12px] leading-relaxed text-foreground">{selectedMethodology.fit}</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {selectedMethodology.howItWorks}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Tip: If your team is unsure yet, select Decide later and start planning your first meeting.
                      </p>
                    )}
                  </div>
                </div>
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
