"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCircle, type Group } from "@/contexts/CircleContext";
import JoinCreateDialog from "@/components/circles/JoinCreateDialog";
import supabase from "@/lib/supabaseClient";

type GroupWithMeta = Group & {
  memberCount: number;
};

export default function CircleSwitcher() {
  const { activeCircle, setActiveCircle } = useCircle();
  const [groups, setGroups] = useState<GroupWithMeta[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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

    const fetchedGroups = membershipData
      .map((row) => row.groups as Group | null)
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

  const groupItems = useMemo(() => groups, [groups]);

  return (
    <div className="mt-1 px-2">
      <div className="mb-2 px-1 text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase">
        My Circles
      </div>

      <div className="flex flex-col gap-px">
        {groupItems.map((group) => {
          const isActive = activeCircle?.id === group.id;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setActiveCircle(group)}
              className={[
                "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                isActive ? "bg-accent" : "hover:bg-zinc-100",
              ].join(" ")}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: group.color ?? "#4f46e5" }}
              />
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-medium text-zinc-900">{group.name}</span>
                <span className="block truncate text-[10px] text-zinc-500">
                  {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                  {group.subject ? ` · ${group.subject}` : ""}
                </span>
              </span>
              <span className="ml-auto mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
            </button>
          );
        })}

        {!loading && groupItems.length === 0 ? (
          <div className="rounded-md px-2 py-2 text-[11px] text-zinc-500">No circles yet.</div>
        ) : null}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-1 h-7 w-full justify-start text-[12px] font-normal text-zinc-600 hover:text-zinc-900"
        onClick={() => setDialogOpen(true)}
      >
        <Plus className="size-3" />
        Join or create circle
      </Button>

      <JoinCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existingGroupCount={groups.length}
        onCompleted={() => {
          void loadGroups();
        }}
      />
    </div>
  );
}
