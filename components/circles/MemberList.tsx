"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useCircle } from "@/contexts/CircleContext";
import supabase from "@/lib/supabaseClient";

const MEMBER_COLORS = ["#4f46e5", "#16a34a", "#ea580c", "#9333ea", "#2563eb", "#ca8a04"];

function getMemberName(fullName: string | null, email: string | null) {
  if (fullName?.trim()) {
    return fullName.trim();
  }
  if (email) {
    return email.split("@")[0];
  }
  return "Member";
}

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function MemberList() {
  const { activeCircle, members } = useCircle();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setUserId(data.user?.id ?? null);
      }
    }

    void loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  if (!activeCircle) {
    return null;
  }

  return (
    <div className="px-2 pb-2">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[11px] font-medium tracking-[0.08em] text-zinc-500 uppercase">Members</span>
        <span className="text-[10px] text-zinc-500">{members.length}</span>
      </div>

      <div className="flex flex-col gap-px">
        {members.map((member, index) => {
          const displayName = getMemberName(member.full_name, member.email);
          const isYou = member.id === userId;

          return (
            <div key={member.id} className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
              <Avatar
                className="h-6 w-6 text-[10px]"
                style={{ backgroundColor: member.color ?? MEMBER_COLORS[index % MEMBER_COLORS.length] }}
              >
                {getInitials(displayName)}
              </Avatar>
              <span className="truncate text-[12px] font-medium text-zinc-900">
                {displayName}
                {isYou ? <span className="ml-1 font-normal text-zinc-500">(you)</span> : null}
              </span>
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
            </div>
          );
        })}

        {members.length === 0 ? (
          <div className="rounded-md px-2 py-2 text-[11px] text-zinc-500">No members to show.</div>
        ) : null}
      </div>
    </div>
  );
}
