"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Shield } from "lucide-react";
import { useCircle, type Profile } from "@/contexts/CircleContext";

type MemberManagementModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string | undefined;
  members: Profile[];
  currentUserId: string | null;
  isPm: boolean;
  onMemberRemoved?: () => void;
};

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

export default function MemberManagementModal({
  open,
  onOpenChange,
  groupId,
  members,
  currentUserId,
  isPm,
  onMemberRemoved,
}: MemberManagementModalProps) {
  const { updateMemberRole, removeMember } = useCircle();
  const [removing, setRemoving] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [demoting, setDemoting] = useState<string | null>(null);

  async function postMemberAction(url: string) {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      throw new Error(await res.text());
    }
  }

  async function handlePromoteCopm(memberId: string) {
    if (!groupId || !isPm) return;

    setPromoting(memberId);
    try {
      await postMemberAction(`/api/circles/${groupId}/members/${memberId}/promote`);
      updateMemberRole(memberId, "copm");
      window.dispatchEvent(new Event("activity-notifications:refresh"));
    } catch (e) {
      console.error("Failed to promote member:", e);
    } finally {
      setPromoting(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!groupId || !isPm) return;

    if (!confirm("Remove this member from the circle?")) return;

    setRemoving(memberId);
    try {
      await postMemberAction(`/api/circles/${groupId}/members/${memberId}/remove`);
      removeMember(memberId);
      window.dispatchEvent(new Event("activity-notifications:refresh"));
      onMemberRemoved?.();
    } catch (e) {
      console.error("Failed to remove member:", e);
    } finally {
      setRemoving(null);
    }
  }

  async function handleDemoteCopm(memberId: string) {
    if (!groupId || !isPm) return;

    setDemoting(memberId);
    try {
      await postMemberAction(`/api/circles/${groupId}/members/${memberId}/demote`);
      updateMemberRole(memberId, "member");
      window.dispatchEvent(new Event("activity-notifications:refresh"));
    } catch (e) {
      console.error("Failed to demote member:", e);
    } finally {
      setDemoting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {members.map((member, index) => {
            const displayName = getMemberName(member.full_name, member.email);
            const isYou = member.id === currentUserId;
            const role = (member.memberRole ?? "member").toLowerCase();
            const isCoPm = role === "copm";
            const isPmRole = role === "pm";

            return (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <Avatar
                  className="h-8 w-8 text-xs"
                  style={{ backgroundColor: member.color ?? MEMBER_COLORS[index % MEMBER_COLORS.length] }}
                >
                  {getInitials(displayName)}
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900">
                    {displayName}
                    {isYou ? <span className="ml-1 font-normal text-zinc-500">(you)</span> : null}
                  </div>
                  <Badge
                    variant={isPmRole ? "success" : isCoPm ? "secondary" : "outline"}
                    className="mt-1 text-xs"
                  >
                    {isPmRole ? "PM" : isCoPm ? "Co-PM" : "Member"}
                  </Badge>
                </div>

                {!isYou && isPm && (
                  <div className="flex gap-1">
                    {role === "copm" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        onClick={() => handleDemoteCopm(member.id)}
                        disabled={demoting === member.id}
                        title="Demote to Member"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                    )}

                    {role !== "copm" && role !== "owner" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handlePromoteCopm(member.id)}
                        disabled={promoting === member.id}
                        title="Promote to Co-PM"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                    )}

                    {role !== "owner" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removing === member.id}
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
