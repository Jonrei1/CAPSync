"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import supabase from "@/lib/supabaseClient";

export type Group = {
  id: string;
  name: string;
  subject: string | null;
  color: string | null;
  invite_code?: string | null;
  methodology?: string | null;
  created_by?: string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  color?: string | null;
  memberRole?: string;
};

type CircleContextValue = {
  activeCircle: Group | null;
  setActiveCircle: Dispatch<SetStateAction<Group | null>>;
  members: Profile[];
  updateMemberColor: (memberId: string, color: string) => void;
  dialogOpen: boolean;
  setDialogOpen: Dispatch<SetStateAction<boolean>>;
  dialogTab: "join" | "create";
  setDialogTab: Dispatch<SetStateAction<"join" | "create">>;
  openJoinCreateDialog: (tab: "join" | "create") => void;
};

const CircleContext = createContext<CircleContextValue | null>(null);

type CircleProviderProps = {
  children: ReactNode;
};

export function CircleProvider({ children }: CircleProviderProps) {
  const [activeCircle, setActiveCircle] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"join" | "create">("join");

  const updateMemberColor = useCallback((memberId: string, color: string) => {
    setMembers((current) =>
      current.map((member) => (member.id === memberId ? { ...member, color } : member)),
    );
  }, []);

  const openJoinCreateDialog = (tab: "join" | "create") => {
    setDialogTab(tab);
    setDialogOpen(true);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadMembers() {
      if (!activeCircle) {
        if (isMounted) {
          setMembers([]);
        }
        return;
      }

      const { data, error } = await supabase
        .from("group_members")
        .select("role, color, profiles(id, full_name, email, color)")
        .eq("group_id", activeCircle.id)
        .order("joined_at", { ascending: true });

      // Keep compatibility with older DBs that do not yet have group_members.color.
      let membershipRows = data;
      let membershipError = error;

      if (membershipError && membershipError.message.includes("column group_members.color does not exist")) {
        const fallbackResult = await supabase
          .from("group_members")
          .select("role, profiles(id, full_name, email, color)")
          .eq("group_id", activeCircle.id)
          .order("joined_at", { ascending: true });

        membershipRows = fallbackResult.data as typeof membershipRows;
        membershipError = fallbackResult.error;
      }

      if (!isMounted) {
        return;
      }

      if (membershipError || !membershipRows) {
        setMembers([]);
        return;
      }

      const mappedMembers = (
        membershipRows as unknown as Array<{
          role: string;
          color?: string | null;
          profiles: Profile | null;
        }>
      )
        .filter((row) => row.profiles)
        .map((row) => ({
          ...row.profiles,
          color: row.color ?? row.profiles?.color ?? null,
          memberRole: row.role,
        })) as Profile[];

      setMembers(mappedMembers);
    }

    void loadMembers();

    return () => {
      isMounted = false;
    };
  }, [activeCircle]);

  const value = useMemo(
    () => ({ 
      activeCircle, 
      setActiveCircle, 
      members,
      updateMemberColor,
      dialogOpen,
      setDialogOpen,
      dialogTab,
      setDialogTab,
      openJoinCreateDialog,
    }),
    [activeCircle, members, updateMemberColor, dialogOpen, dialogTab],
  );

  return <CircleContext.Provider value={value}>{children}</CircleContext.Provider>;
}

export function useCircle() {
  const context = useContext(CircleContext);

  if (!context) {
    throw new Error("useCircle must be used within CircleProvider");
  }

  return context;
}
