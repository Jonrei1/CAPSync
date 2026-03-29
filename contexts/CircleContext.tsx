"use client";

import {
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
        .select("role, profiles(id, full_name, email, color)")
        .eq("group_id", activeCircle.id)
        .order("joined_at", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (error || !data) {
        setMembers([]);
        return;
      }

      const mappedMembers = (data as unknown as Array<{ role: string; profiles: Profile | null }>)
        .filter((row) => row.profiles)
        .map((row) => ({
          ...row.profiles,
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
      dialogOpen,
      setDialogOpen,
      dialogTab,
      setDialogTab,
      openJoinCreateDialog,
    }),
    [activeCircle, members, dialogOpen, dialogTab],
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
