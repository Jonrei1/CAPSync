"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, ChevronDown, Calendar, CheckSquare2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCircle, type Group } from "@/contexts/CircleContext";
import supabase from "@/lib/supabaseClient";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type GroupWithMeta = Group & {
  memberCount: number;
};

type MembershipRow = {
  group_id: string;
  groups: Group | Group[] | null;
};

export default function CircleSwitcher() {
  const { activeCircle, setActiveCircle, openJoinCreateDialog } = useCircle();
  const router = useRouter();
  const [groups, setGroups] = useState<GroupWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const pathname = usePathname();

  async function loadGroups() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const { data: membershipData, error } = await supabase
      .from("group_members")
      .select("group_id, groups(*)")
      .eq("member_id", userId);

    if (error || !membershipData) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const fetchedGroups = (membershipData as MembershipRow[])
      .map((row) => (Array.isArray(row.groups) ? (row.groups[0] ?? null) : row.groups))
      .filter((group): group is Group => Boolean(group));

    if (fetchedGroups.length === 0) {
      setGroups([]);
      if (!activeCircle) {
        setActiveCircle(null);
      }
      setLoading(false);
      return;
    }

    const groupIds = fetchedGroups.map((group) => group.id);
    const { data: countRows } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", groupIds);

    const countMap = new Map<string, number>();
    for (const row of countRows ?? []) {
      countMap.set(row.group_id, (countMap.get(row.group_id) ?? 0) + 1);
    }

    const normalizedGroups = fetchedGroups.map((group) => ({
      ...group,
      memberCount: countMap.get(group.id) ?? 1,
    }));

    setGroups(normalizedGroups);

    if (!activeCircle) {
      setActiveCircle(normalizedGroups[0]);
    } else {
      const stillPresent = normalizedGroups.find((group) => group.id === activeCircle.id);
      if (!stillPresent) {
        setActiveCircle(normalizedGroups[0]);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeCircle) {
      return;
    }

    setGroups((current) =>
      current.map((group) => (group.id === activeCircle.id ? { ...group, color: activeCircle.color } : group)),
    );
  }, [activeCircle]);

  const groupItems = useMemo(() => groups, [groups]);

  return (
    <div className="mt-1 px-2">
      <div className="mb-2 px-1 text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
        My Circles
      </div>

      <div className="flex flex-col gap-px">
        {groupItems.map((group) => {
          const isActive = activeCircle?.id === group.id;
          const isExpanded = expandedGroupId === group.id;
          
          const circleSubNav = [
            {
              label: "Calendar",
              href: `/app/${group.id}/calendar`,
              icon: Calendar,
            },
            {
              label: "Tracker",
              href: `/app/${group.id}/tracker`,
              icon: CheckSquare2,
            },
            {
              label: "Fund",
              href: `/app/${group.id}/fund`,
              icon: Wallet,
            },
          ];

          return (
            <div key={group.id}>
              <div
                className={[
                  "group flex w-full items-center gap-1 rounded-md px-1 py-1 transition-colors",
                  isActive ? "bg-accent" : "hover:bg-zinc-100",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveCircle(group);
                    void router.push("/dashboard");
                  }}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: group.color ?? "#4f46e5" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-zinc-900">{group.name}</span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                      {group.subject ? ` · ${group.subject}` : ""}
                    </span>
                  </span>
                  <span className="ml-0.5 mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveCircle(group);
                    setExpandedGroupId(isExpanded ? null : group.id);
                  }}
                  className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-400 hover:bg-white hover:text-zinc-700"
                  aria-label={isExpanded ? `Collapse ${group.name} menu` : `Expand ${group.name} menu`}
                >
                  <ChevronDown
                    className={[
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      isExpanded ? "rotate-180" : "",
                    ].join(" ")}
                  />
                </button>
              </div>

              {isExpanded && isActive && (
                <div className="flex flex-col gap-px bg-zinc-50 py-1 pl-4">
                  {circleSubNav.map((item) => {
                    const isSubActive =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={[
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors",
                          isSubActive
                            ? "bg-white font-medium text-zinc-900"
                            : "text-zinc-600 hover:bg-white hover:text-zinc-900",
                        ].join(" ")}
                      >
                        <item.icon className="h-3.5 w-3.5 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {!loading && groupItems.length === 0 ? (
          <div className="rounded-md px-2 py-2 text-[11px] text-zinc-500">No circles yet.</div>
        ) : null}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-1 h-7 w-full cursor-pointer justify-start text-[12px] font-normal text-zinc-600 hover:text-zinc-900"
        onClick={() => openJoinCreateDialog("join")}
      >
        <Plus className="size-3" />
        Join or create circle
      </Button>
    </div>
  );
}
