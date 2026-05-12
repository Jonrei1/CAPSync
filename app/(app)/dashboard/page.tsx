"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, FolderKanban, Users, WalletCards, CalendarDays, Eye, EyeOff, MoreVertical, Shield, Trash2 } from "lucide-react";
import MemberManagementModal from "@/components/circles/MemberManagementModal";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { designTokens } from "@/components/ui/design-standard";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCircle } from "@/contexts/CircleContext";
import supabase from "@/lib/supabaseClient";

const MEMBER_COLORS = designTokens.palette.app.memberSet;

type DashboardStats = {
  doneCount: number;
  overdueCount: number;
  fundBalance: number;
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

function formatMethodology(methodology: string | null | undefined) {
  if (!methodology?.trim()) {
    return "Not set";
  }

  return methodology
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function DashboardPage() {
  const {
    activeCircle,
    setActiveCircle,
    members,
    openJoinCreateDialog,
    updateMemberColor,
    updateMemberRole,
    removeMember,
  } = useCircle();
  const [stats, setStats] = useState<DashboardStats>({
    doneCount: 0,
    overdueCount: 0,
    fundBalance: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("Account");
  const [copied, setCopied] = useState(false);
  const [memberColorDraftByCircle, setMemberColorDraftByCircle] = useState<Record<string, string>>({});
  const [circleColorDraftByCircle, setCircleColorDraftByCircle] = useState<Record<string, string>>({});
  const [savingMemberColor, setSavingMemberColor] = useState(false);
  const [savingCircleColor, setSavingCircleColor] = useState(false);
  const [memberColorError, setMemberColorError] = useState("");
  const [circleColorError, setCircleColorError] = useState("");
  const [memberManagementOpen, setMemberManagementOpen] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [openMenuMemberId, setOpenMenuMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [promotingMemberId, setPromotingMemberId] = useState<string | null>(null);
  const [demotingMemberId, setDemotingMemberId] = useState<string | null>(null);
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
    const activeCircleId = activeCircle?.id;

    async function loadStats() {
      if (!activeCircleId) {
        if (mounted) {
          setStats({ doneCount: 0, overdueCount: 0, fundBalance: 0 });
        }
        return;
      }

      setStatsLoading(true);

      const today = new Date().toISOString().slice(0, 10);

      const [doneResult, overdueResult, fundResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("group_id", activeCircleId)
          .eq("status", "done"),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("group_id", activeCircleId)
          .lt("due_date", today)
          .neq("status", "done"),
        supabase
          .from("group_fund")
          .select("balance")
          .eq("group_id", activeCircleId)
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
      });

      setStatsLoading(false);
    }

    void loadStats();

    return () => {
      mounted = false;
    };
  }, [activeCircle?.id, members.length]);

  const yourMembership = useMemo(
    () => members.find((member) => member.id === userId),
    [members, userId],
  );

  const currentMemberColor =
    activeCircle && yourMembership
      ? (memberColorDraftByCircle[activeCircle.id] ?? yourMembership.color ?? MEMBER_COLORS[0])
      : MEMBER_COLORS[0];

  const membershipRole = (yourMembership?.memberRole ?? "").toLowerCase();
  const isPm = membershipRole === "pm";
  const isCoPm = membershipRole === "copm";
  const canManageCircle = isPm || isCoPm;

  const currentCircleColor =
    activeCircle
      ? (circleColorDraftByCircle[activeCircle.id] ?? activeCircle.color ?? MEMBER_COLORS[0])
      : MEMBER_COLORS[0];

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

  async function handleSaveCircleColor() {
    if (!activeCircle) {
      return;
    }

    setSavingCircleColor(true);
    setCircleColorError("");

    const { error } = await supabase
      .from("groups")
      .update({ color: currentCircleColor })
      .eq("id", activeCircle.id);

    if (error) {
      setCircleColorError(error.message);
      setSavingCircleColor(false);
      return;
    }

    setActiveCircle((current) => (current ? { ...current, color: currentCircleColor } : current));
    setSavingCircleColor(false);
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
                className={[
                  "h-6 w-6 cursor-pointer rounded-full border transition-shadow",
                  currentMemberColor === color ? "ring-2 ring-zinc-900 ring-offset-1" : "",
                ].join(" ")}
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
              {savingMemberColor ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner className="h-3 w-3" />
                  Saving...
                </span>
              ) : (
                "Save color"
              )}
            </Button>
          </div>
        </div>
        {memberColorError ? <p className="mt-2 text-xs text-red-600">{memberColorError}</p> : null}
      </section>

      <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
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

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Badge variant={isPm ? "success" : isCoPm ? "secondary" : "outline"}>{isPm ? "PM" : isCoPm ? "Co-PM" : "Member"}</Badge>
            {canManageCircle && activeCircle.invite_code ? (
              <div className="inline-flex items-center gap-2 rounded-full border bg-zinc-100 px-3 py-1 text-xs">
                <span className="font-medium">
                  Code: {showInviteCode ? activeCircle.invite_code : "••••••"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowInviteCode(!showInviteCode)}
                  className="inline-flex cursor-pointer items-center gap-1 text-zinc-600 hover:text-zinc-900"
                  title={showInviteCode ? "Hide code" : "Show code"}
                >
                  {showInviteCode ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </button>
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
            {canManageCircle && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setMemberManagementOpen(true)}
                title="Manage members"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <label htmlFor="circle-color" className="text-xs font-medium text-zinc-600">
            Circle color
          </label>
          <input
            id="circle-color"
            type="color"
            value={currentCircleColor}
            onChange={(event) => {
              if (!activeCircle) {
                return;
              }

              const nextColor = event.target.value;
              setCircleColorDraftByCircle((current) => ({ ...current, [activeCircle.id]: nextColor }));
            }}
            className="h-8 w-10 cursor-pointer rounded border p-1"
            aria-label="Choose circle color"
            disabled={!canManageCircle}
          />
          {MEMBER_COLORS.map((color) => (
            <button
              key={`circle-${color}`}
              type="button"
              onClick={() => {
                if (!activeCircle) {
                  return;
                }

                setCircleColorDraftByCircle((current) => ({ ...current, [activeCircle.id]: color }));
              }}
              className={[
                "h-6 w-6 cursor-pointer rounded-full border transition-shadow",
                currentCircleColor === color ? "ring-2 ring-zinc-900 ring-offset-1" : "",
              ].join(" ")}
              style={{ backgroundColor: color }}
              aria-label={`Pick circle color ${color}`}
              disabled={!canManageCircle}
            />
          ))}
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            onClick={handleSaveCircleColor}
            disabled={!canManageCircle || savingCircleColor}
          >
            {savingCircleColor ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner className="h-3 w-3" />
                Saving...
              </span>
            ) : (
              "Save circle color"
            )}
          </Button>
          {!canManageCircle ? <span className="text-xs text-zinc-500">Only PM and Co-PM can change circle color.</span> : null}
        </div>
        {circleColorError ? <p className="mt-2 text-xs text-red-600">{circleColorError}</p> : null}
      </section>

      <section>
        <div className="grid grid-cols-4 gap-3">
          {members.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card py-5 flex flex-col items-center gap-3 px-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-2 w-2 rounded-full" />
              </div>
            ))
          ) : (
            members.map((member, index) => {
              const name = memberName(member.full_name, member.email);
              const role = (member.memberRole ?? "member").toLowerCase();
              const roleDisplay = role === "pm" ? "PM" : role === "copm" ? "Co-PM" : "Member";
              const isYou = member.id === userId;
              const isOpen = openMenuMemberId === member.id;

              async function handlePromote() {
                if (!activeCircle) return;
                setPromotingMemberId(member.id);
                try {
                  const response = await fetch(`/api/circles/${activeCircle.id}/members/${member.id}/promote`, {
                    method: "POST",
                  });
                  if (!response.ok) {
                    throw new Error(await response.text());
                  }
                  updateMemberRole(member.id, "copm");
                } catch (e) {
                  console.error("Failed to promote:", e);
                } finally {
                  setPromotingMemberId(null);
                  setOpenMenuMemberId(null);
                }
              }

              async function handleRemove() {
                if (!activeCircle) return;
                if (!confirm(`Remove ${name} from this circle?`)) return;
                setRemovingMemberId(member.id);
                try {
                  const response = await fetch(`/api/circles/${activeCircle.id}/members/${member.id}/remove`, {
                    method: "POST",
                  });
                  if (!response.ok) {
                    throw new Error(await response.text());
                  }
                  removeMember(member.id);
                } catch (e) {
                  console.error("Failed to remove:", e);
                } finally {
                  setRemovingMemberId(null);
                  setOpenMenuMemberId(null);
                }
              }

              async function handleDemote() {
                if (!activeCircle) return;
                setDemotingMemberId(member.id);
                try {
                  const response = await fetch(`/api/circles/${activeCircle.id}/members/${member.id}/demote`, {
                    method: "POST",
                  });
                  if (!response.ok) {
                    throw new Error(await response.text());
                  }
                  updateMemberRole(member.id, "member");
                } catch (e) {
                  console.error("Failed to demote:", e);
                } finally {
                  setDemotingMemberId(null);
                  setOpenMenuMemberId(null);
                }
              }

              return (
                <Card key={member.id} className="gap-4 py-5 relative group">
                  <CardContent className="flex flex-col items-center gap-2 text-center">
                    <Avatar
                      className="h-10 w-10 text-xs"
                      style={{ backgroundColor: member.color ?? MEMBER_COLORS[index % MEMBER_COLORS.length] }}
                    >
                      {memberInitials(name)}
                    </Avatar>
                    <div className="text-sm font-medium text-zinc-900">{name}</div>
                    <Badge variant={role === "pm" ? "success" : role === "copm" ? "secondary" : "outline"}>{roleDisplay}</Badge>
                  </CardContent>
                  
                  {canManageCircle && !isYou && (
                    <div className="absolute top-2 right-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuMemberId(isOpen ? null : member.id)}
                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                          title="Member actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        
                        {isOpen && (
                          <div className="absolute right-0 top-8 z-10 w-40 rounded-lg border bg-white shadow-lg">
                            {role === "copm" && (
                              <button
                                type="button"
                                onClick={handleDemote}
                                disabled={demotingMemberId === member.id}
                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-amber-600 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Shield className="h-4 w-4" />
                                Demote to Member
                              </button>
                            )}
                            {role !== "copm" && role !== "owner" && (
                              <button
                                type="button"
                                onClick={handlePromote}
                                disabled={promotingMemberId === member.id}
                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Shield className="h-4 w-4" />
                                Promote to Co-PM
                              </button>
                            )}
                            {role !== "owner" && (
                              <button
                                type="button"
                                onClick={handleRemove}
                                disabled={removingMemberId === member.id}
                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </section>

      <section className="grid grid-cols-4 gap-3">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-zinc-100 py-4 px-4 flex flex-col gap-3">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-7 w-16 rounded" />
            </div>
          ))
        ) : (
          <>
            <Card className="gap-3 bg-zinc-100 py-4">
              <CardHeader className="px-4 pb-0">
                <CardDescription className="text-[11px] font-medium tracking-[0.06em] uppercase">
                  Tasks done this sprint
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pt-0">
                <div className="text-2xl font-semibold tracking-tight">{stats.doneCount}</div>
              </CardContent>
            </Card>

            <Card className="gap-3 bg-zinc-100 py-4">
              <CardHeader className="px-4 pb-0">
                <CardDescription className="text-[11px] font-medium tracking-[0.06em] uppercase">
                  Fund balance
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pt-0">
                <div className="text-2xl font-semibold tracking-tight">{`₱${stats.fundBalance.toLocaleString()}`}</div>
              </CardContent>
            </Card>

            <Card className="gap-3 bg-zinc-100 py-4">
              <CardHeader className="px-4 pb-0">
                <CardDescription className="text-[11px] font-medium tracking-[0.06em] uppercase">
                  Overdue tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pt-0">
                <div className="text-2xl font-semibold tracking-tight text-red-600">{stats.overdueCount}</div>
              </CardContent>
            </Card>

            <Card className="gap-3 bg-zinc-100 py-4">
              <CardHeader className="px-4 pb-0">
                <CardDescription className="text-[11px] font-medium tracking-[0.06em] uppercase">
                  Methodology
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pt-0">
                <div className="text-xl font-semibold tracking-tight text-zinc-900">
                  {formatMethodology(activeCircle.methodology)}
                </div>
              </CardContent>
            </Card>
          </>
        )}
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
            <Link href={`/${activeCircle.id}/calendar`} className="cursor-pointer text-sm font-medium text-zinc-700 hover:text-zinc-900">
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
            <Link href={`/${activeCircle.id}/tracker`} className="cursor-pointer text-sm font-medium text-zinc-700 hover:text-zinc-900">
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
            <Link href={`/${activeCircle.id}/fund`} className="cursor-pointer text-sm font-medium text-zinc-700 hover:text-zinc-900">
              Open Fund →
            </Link>
          </CardContent>
        </Card>
      </section>

      <MemberManagementModal
        open={memberManagementOpen}
        onOpenChange={setMemberManagementOpen}
        groupId={activeCircle.id}
        members={members}
        currentUserId={userId}
            isPm={canManageCircle}
      />
    </div>
  );
}
