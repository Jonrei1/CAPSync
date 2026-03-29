"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "../supabaseClient";

type Circle = {
  id: string;
  [key: string]: unknown;
} | null;

type CircleMember = {
  id: string;
  [key: string]: unknown;
};

type CircleContextValue = {
  circle: Circle;
  members: CircleMember[];
  setCircle: (value: Circle) => void;
};

const CircleContext = createContext<CircleContextValue | undefined>(undefined);

type CircleProviderProps = {
  circleId: string;
  children: ReactNode;
};

export function CircleProvider({ circleId, children }: CircleProviderProps) {
  const [circle, setCircle] = useState<Circle>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadCircleData() {
      if (!circleId) {
        if (!active) {
          return;
        }

        setCircle(null);
        setMembers([]);
        return;
      }

      const [groupResult, membersResult] = await Promise.all([
        supabase.from("group").select("*").eq("id", circleId).maybeSingle(),
        supabase.from("group_members").select("*").eq("group_id", circleId),
      ]);

      if (!active) {
        return;
      }

      if (groupResult.error) {
        setCircle(null);
      } else {
        setCircle((groupResult.data as Circle) ?? null);
      }

      if (membersResult.error) {
        setMembers([]);
      } else {
        setMembers((membersResult.data as CircleMember[]) ?? []);
      }
    }

    void loadCircleData();

    return () => {
      active = false;
    };
  }, [circleId]);

  const value = useMemo(
    () => ({ circle, members, setCircle }),
    [circle, members],
  );

  return (
    <CircleContext.Provider value={value}>{children}</CircleContext.Provider>
  );
}

export function useCircle() {
  const context = useContext(CircleContext);

  if (!context) {
    throw new Error("useCircle must be used within a CircleProvider");
  }

  return context;
}
