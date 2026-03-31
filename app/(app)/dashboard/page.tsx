"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, FolderKanban, Users, WalletCards, CalendarDays, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCircle } from "@/contexts/CircleContext";
import supabase from "@/lib/supabaseClient";

const MEMBER_COLORS = ["#4f46e5", "#16a34a", "#ea580c", "#9333ea", "#2563eb", "#ca8a04"];

type DashboardStats = {
  doneCount: number;
  overdueCount: number;
  fundBalance: number;
  membersOnline: number;
};

function memberName(fullName: string | null, email: string | null) {
  if (fullName?.trim()) {
    return fullName.trim();
  }
  if (email) {
    return email.split("@")[0];
  }
  return "Member";
}

function memberInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function DashboardPage() {
  const { activeCircle, members, openJoinCreateDialog, updateMemberColor } = useCircle();
  const [stats, setStats] = useState<DashboardStats>({
    doneCount: 0,
    overdueCount: 0,
    fundBalance: 0,
    membersOnline: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("Account");
  const [copied, setCopied] = useState(false);
  const [memberColorDraftByCircle, setMemberColorDraftByCircle] = useState<Record<string, string>>({});
  const [savingMemberColor, setSavingMemberColor] = useState(false);
  const [memberColorError, setMemberColorError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const authUser = data.user;
      const fallbackName =
        ((authUser?.user_metadata?.full_name as string | undefined) ??
          (authUser?.user_metadata?.name as string | undefined) ??
          authUser?.email?.split("@")[0] ??
          "Account").trim();

      try {
        const response = await fetch("/api/profile/me");
        if (response.ok) {
          const payload = (await response.json()) as {
            profile?: { full_name?: string | null; email?: string | null };
          };
          const profileName =
            payload.profile?.full_name?.trim() ||
            payload.profile?.email?.split("@")[0] ||
            fallbackName;

          if (mounted) {
            setAccountName(profileName);
          }
        }
      } catch {
        if (mounted) {
          setAccountName(fallbackName);
        }
      }

      if (mounted) {
        setUserId(authUser?.id ?? null);
        setAccountName((name) => name || fallbackName);
      }
    }

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      if (!activeCircle) {
        if (mounted) {
          setStats({ doneCount: 0, overdueCount: 0, fundBalance: 0, membersOnline: 0 });
        }
        return;
      }

      setStatsLoading(true);

      const today = new Date().toISOString().slice(0, 10);

      const [doneResult, overdueResult, fundResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("group_id", activeCircle.id)
          .eq("status", "done"),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("group_id", activeCircle.id)
          .lt("due_date", today)
          .neq("status", "done"),
        supabase
          .from("group_fund")
          .select("balance")
          .eq("group_id", activeCircle.id)
          .maybeSingle(),
      ]);

      if (!mounted) {
        return;
      }

      setStats({
        doneCount: doneResult.count ?? 0,
        overdueCount: overdueResult.count ?? 0,
        fundBalance:
          typeof fundResult.data?.balance === "number"
            ? fundResult.data.balance
            : Number(fundResult.data?.balance ?? 0),
        membersOnline: members.length,
      });

      setStatsLoading(false);
    }

    void loadStats();

    return () => {
      mounted = false;
    };
  }, [activeCircle, members.length]);

  const yourMembership = useMemo(
    () => members.find((member) => member.id === userId),
    [members, userId],
  );

  const currentMemberColor =
    activeCircle && yourMembership
      ? (memberColorDraftByCircle[activeCircle.id] ?? yourMembership.color ?? MEMBER_COLORS[0])
      : MEMBER_COLORS[0];

  const isPm = (yourMembership?.memberRole ?? "").toLowerCase() === "pm";

  async function handleCopyInviteCode() {
    if (!activeCircle?.invite_code) {
      return;
    }

    await navigator.clipboard.writeText(activeCircle.invite_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function handleSaveMemberColor() {
    if (!activeCircle || !userId) {
      return;
    }

    setSavingMemberColor(true);
    setMemberColorError("");

    const { error } = await supabase
      .from("group_members")
      .update({ color: currentMemberColor })
      .eq("group_id", activeCircle.id)
      .eq("member_id", userId);

    if (error) {
      setMemberColorError(error.message);
      setSavingMemberColor(false);
      return;
    }

    updateMemberColor(userId, currentMemberColor);
    setSavingMemberColor(false);
  }

  if (!activeCircle) {
    return (
      <>
        <div className="flex min-h-[70vh] items-center justify-center px-3">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center rounded-xl border bg-white p-8 text-center shadow-sm">
            <div className="mb-4 rounded-full bg-zinc-100 p-4 text-zinc-700">
              <Users className="size-8" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">You&apos;re not in any circles yet</h1>
            <p className="mt-2 max-w-md text-sm text-zinc-600">
              Create a new circle for your group, or ask your PM for an invite code.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button className="cursor-pointer" onClick={() => openJoinCreateDialog("create")}>Create a circle</Button>
              <Button variant="outline" className="cursor-pointer" onClick={() => openJoinCreateDialog("join")}>
                Join with code
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.08em] text-zinc-500 uppercase">Signed in as</p>
            <p className="mt-1 text-base font-semibold text-zinc-900">{accountName}</p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label htmlFor="member-color" className="text-xs font-medium text-zinc-600">
              Your color
            </label>
            <input
              id="member-color"
              type="color"
              value={currentMemberColor}
              onChange={(event) => {
                if (!activeCircle) {
                  return;
                }

                const nextColor = event.target.value;
                setMemberColorDraftByCircle((current) => ({ ...current, [activeCircle.id]: nextColor }));
              }}
              className="h-8 w-10 cursor-pointer rounded border p-1"
              aria-label="Choose your member color"
            />
            {MEMBER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  if (!activeCircle) {
                    return;
                  }

                  setMemberColorDraftByCircle((current) => ({ ...current, [activeCircle.id]: color }));
                }}
                className="h-6 w-6 cursor-pointer rounded-full border"
                style={{ backgroundColor: color }}
                aria-label={`Pick color ${color}`}
              />
            ))}
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              onClick={handleSaveMemberColor}
              disabled={!activeCircle || !userId || savingMemberColor}
            >
              {savingMemberColor ? "Saving..." : "Save color"}
            </Button>
          </div>
        </div>
        {memberColorError ? <p className="mt-2 text-xs text-red-600">{memberColorError}</p> : null}
      </section>

      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: activeCircle.color ?? "#4f46e5" }}
              />
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{activeCircle.name}</h1>
            </div>
            <p className="mt-1 text-sm text-zinc-600">{activeCircle.subject ?? "No subject set"}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isPm ? "success" : "secondary"}>{isPm ? "PM" : "Member"}</Badge>
            {isPm && activeCircle.invite_code ? (
              <div className="inline-flex items-center gap-2 rounded-full border bg-zinc-100 px-3 py-1 text-xs">
                <span className="font-medium">Code: {activeCircle.invite_code}</span>
                <button
                  type="button"
                  onClick={handleCopyInviteCode}
                  className="inline-flex cursor-pointer items-center gap-1 text-zinc-600 hover:text-zinc-900"
                >
                  <Copy className="size-3" />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-4 gap-3">
          {members.map((member, index) => {
            const name = memberName(member.full_name, member.email);
            const role = (member.memberRole ?? "member").toLowerCase() === "pm" ? "PM" : "Member";

            return (
              <Card key={member.id} className="gap-4 py-5">
                <CardContent className="flex flex-col items-center gap-2 text-center">
                  <Avatar
                    className="h-10 w-10 text-xs"
                    style={{ backgroundColor: member.color ?? MEMBER_COLORS[index % MEMBER_COLORS.length] }}
                  >
                    {memberInitials(name)}
                  </Avatar>
                  <div className="text-sm font-medium text-zinc-900">{name}</div>
                  <Badge variant={role === "PM" ? "success" : "secondary"}>{role}</Badge>
                  <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-4 gap-3">
        <Card className="gap-3 bg-zinc-100 py-4">
          <CardHeader className="px-4 pb-0">
            <CardDescription className="text-[11px] font-medium tracking-[0.06em] uppercase">
              Tasks done this sprint
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-0">
            <div className="text-2xl font-semibold tracking-tight">{statsLoading ? <Loader2 className="size-5 animate-spin" /> : stats.doneCount}</div>
          </CardContent>
        </Card>

        <Card className="gap-3 bg-zinc-100 py-4">
          <CardHeader className="px-4 pb-0">
            <CardDescription className="text-[11px] font-medium tracking-[0.06em] uppercase">
              Fund balance
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-0">
            <div className="text-2xl font-semibold tracking-tight">{statsLoading ? <Loader2 className="size-5 animate-spin" /> : `₱${stats.fundBalance.toLocaleString()}`}</div>
          </CardContent>
        </Card>

        <Card className="gap-3 bg-zinc-100 py-4">
          <CardHeader className="px-4 pb-0">
            <CardDescription className="text-[11px] font-medium tracking-[0.06em] uppercase">
              Overdue tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-0">
            <div className="text-2xl font-semibold tracking-tight text-red-600">
              {statsLoading ? <Loader2 className="size-5 animate-spin" /> : stats.overdueCount}
            </div>
          </CardContent>
        </Card>

        <Card className="gap-3 bg-zinc-100 py-4">
          <CardHeader className="px-4 pb-0">
            <CardDescription className="text-[11px] font-medium tracking-[0.06em] uppercase">
              Members online
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-0">
            <div className="text-2xl font-semibold tracking-tight text-green-600">{stats.membersOnline}</div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Card className="py-5">
          <CardHeader className="px-5">
            <div className="mb-1 text-zinc-700">
              <CalendarDays className="size-4" />
            </div>
            <CardTitle className="text-sm">Calendar</CardTitle>
            <CardDescription>Plan meetings and deadlines in one timeline.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <Link href="/calendar" className="cursor-pointer text-sm font-medium text-zinc-700 hover:text-zinc-900">
              Open Calendar →
            </Link>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <div className="mb-1 text-zinc-700">
              <FolderKanban className="size-4" />
            </div>
            <CardTitle className="text-sm">Progress Tracker</CardTitle>
            <CardDescription>Track tasks and sprint status for the whole team.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <Link href="/tracker" className="cursor-pointer text-sm font-medium text-zinc-700 hover:text-zinc-900">
              Open Tracker →
            </Link>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <div className="mb-1 text-zinc-700">
              <WalletCards className="size-4" />
            </div>
            <CardTitle className="text-sm">Shared Fund</CardTitle>
            <CardDescription>Monitor contributions, expenses, and balances.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <Link href="/fund" className="cursor-pointer text-sm font-medium text-zinc-700 hover:text-zinc-900">
              Open Fund →
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
