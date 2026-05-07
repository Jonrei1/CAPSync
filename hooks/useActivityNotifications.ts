"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { designTokens } from "@/components/ui/design-standard";
import supabase from "@/lib/supabaseClient";

export type ActivityType = "meeting" | "deadline" | "schedule";

export type ActivityNotification = {
  id: string;
  groupId: string | null;
  groupName: string;
  groupColor: string;
  type: ActivityType;
  title: string;
  eventDate: string | null;
  eventStartHour: number | null;
  eventEndHour: number | null;
  link: string;
  createdByName: string | null;
  createdAt: string;
  readAt: string | null;
};

const FALLBACK_GROUP_NAME = "Personal Calendar";
const FALLBACK_GROUP_COLOR = designTokens.palette.app.brandPrimary;

export function useActivityNotifications() {
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("activity_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) {
      const fallback = await supabase
        .from("activity_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (fallback.error || !fallback.data) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      setNotifications(
        fallback.data.map((row) => ({
          id: row.id,
          groupId: row.group_id ?? null,
          groupName: row.group_name?.trim() || (row.group_id ? "Circle" : FALLBACK_GROUP_NAME),
          groupColor: row.group_color ?? FALLBACK_GROUP_COLOR,
          type: row.type,
          title: row.title,
          eventDate: row.event_date ?? null,
          eventStartHour: row.event_start_hour ?? null,
          eventEndHour: row.event_end_hour ?? null,
          link: row.link,
          createdByName: row.created_by_name ?? null,
          createdAt: row.created_at,
          readAt: row.read_at ?? null,
        })),
      );
      setLoading(false);
      return;
    }

    setNotifications(
      data.map((row) => ({
        id: row.id,
        groupId: row.group_id ?? null,
        groupName: row.group_name?.trim() || (row.group_id ? "Circle" : FALLBACK_GROUP_NAME),
        groupColor: row.group_color ?? FALLBACK_GROUP_COLOR,
        type: row.type,
        title: row.title,
        eventDate: row.event_date ?? null,
        eventStartHour: row.event_start_hour ?? null,
        eventEndHour: row.event_end_hour ?? null,
        link: row.link,
        createdByName: row.created_by_name ?? null,
        createdAt: row.created_at,
        readAt: row.read_at ?? null,
      })),
    );
    setLoading(false);
  }, []);

  const markRead = useCallback(async (id: string) => {
    const timestamp = new Date().toISOString();

    await supabase
      .from("activity_notifications")
      .update({ read_at: timestamp })
      .eq("id", id);

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, readAt: timestamp } : notification,
      ),
    );

    window.dispatchEvent(new Event("activity-notifications:refresh"));
  }, []);

  const markAllRead = useCallback(async () => {
    const timestamp = new Date().toISOString();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    await supabase
      .from("activity_notifications")
      .update({ read_at: timestamp })
      .eq("user_id", user.id)
      .is("read_at", null);

    setNotifications((current) => current.map((notification) => ({ ...notification, readAt: timestamp })));
    window.dispatchEvent(new Event("activity-notifications:refresh"));
  }, []);

  const deleteAll = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const { error } = await supabase.from("activity_notifications").delete().eq("user_id", user.id);

    if (error) {
      return;
    }

    setNotifications([]);
    window.dispatchEvent(new Event("activity-notifications:refresh"));
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    const { error } = await supabase.from("activity_notifications").delete().eq("id", id);

    if (error) {
      return;
    }

    setNotifications((current) => current.filter((notification) => notification.id !== id));
    window.dispatchEvent(new Event("activity-notifications:refresh"));
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      void load();
    };

    window.addEventListener("activity-notifications:refresh", refresh);

    return () => {
      window.removeEventListener("activity-notifications:refresh", refresh);
    };
  }, [load]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) {
        return;
      }

      channel = supabase
        .channel("activity-notifications-rt")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "activity_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void load();
          },
        )
        .subscribe();
    });

    return () => {
      active = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [load]);

  const unread = useMemo(() => notifications.filter((notification) => !notification.readAt), [notifications]);

  return {
    notifications,
    unread,
    unreadCount: unread.length,
    loading,
    markRead,
    markAllRead,
    reload: load,
    deleteAll,
    deleteNotification,
  };
}