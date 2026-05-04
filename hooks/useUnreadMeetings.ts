"use client";

import { useEffect, useState, useCallback } from "react";
import supabase from "@/lib/supabaseClient";

export type UnreadMeeting = {
  id: string;             // schedule_invite id
  scheduleId: string;
  label: string;
  day: string;
  startHour: number;
  groupId: string;
  groupName: string;
  createdByName: string;
  createdAt: string;
};

export function useUnreadMeetings() {
  const [unread, setUnread] = useState<UnreadMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUnread([]); setLoading(false); return; }

    const { data, error } = await supabase
      .from("schedule_invites")
      .select(`
        id,
        schedule_id,
        read_at,
        schedules (
          id,
          label,
          day,
          start_hour,
          group_id,
          created_by_name,
          created_at,
          groups ( name )
        )
      `)
      .eq("member_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) { setUnread([]); setLoading(false); return; }

    const mapped: UnreadMeeting[] = data
      .map((row) => {
        const s = Array.isArray(row.schedules) ? row.schedules[0] : row.schedules;
        if (!s) return null;
        const g = Array.isArray(s.groups) ? s.groups[0] : s.groups;
        return {
          id: row.id,
          scheduleId: s.id,
          label: s.label,
          day: s.day,
          startHour: s.start_hour,
          groupId: s.group_id,
          groupName: g?.name ?? "Circle",
          createdByName: s.created_by_name ?? "Someone",
          createdAt: s.created_at,
        } satisfies UnreadMeeting;
      })
      .filter((item): item is UnreadMeeting => item !== null);

    setUnread(mapped);
    setLoading(false);
  }, []);

  const markAllRead = useCallback(async () => {
    const ids = unread.map((item) => item.id);
    if (!ids.length) return;

    await supabase
      .from("schedule_invites")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);

    setUnread([]);
  }, [unread]);

  const markRead = useCallback(async (inviteId: string) => {
    await supabase
      .from("schedule_invites")
      .update({ read_at: new Date().toISOString() })
      .eq("id", inviteId);

    setUnread((current) => current.filter((item) => item.id !== inviteId));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Real-time subscription: refresh when a new invite comes in for this user
  useEffect(() => {
    let channel = supabase.channel("unread-meetings");

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      channel = supabase
        .channel("unread-meetings")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "schedule_invites",
            filter: `member_id=eq.${user.id}`,
          },
          () => void load(),
        )
        .subscribe();
    });

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { unread, loading, markAllRead, markRead, count: unread.length };
}
