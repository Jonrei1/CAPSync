"use client";

import { useEffect, useState } from "react";
import { Link2, Pencil, Trash2, Plus, Check, X, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import supabase from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import type { CircleLink } from "@/types";

type ImportantLinksProps = {
  groupId: string;
  currentUserId: string | null;
};

export default function ImportantLinks({ groupId, currentUserId }: ImportantLinksProps) {
  const [links, setLinks] = useState<CircleLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CircleLink | null>(null);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    async function fetchLinks() {
      setLoading(true);
      const { data, error } = await supabase
        .from("circle_links")
        .select("*, profiles(full_name)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (!mounted) return;
      if (error) {
        console.error("[ImportantLinks] fetch error:", error);
        toast.error("Failed to load links");
        setLoading(false);
        return;
      }

      setLinks((data as any) ?? []);
      setLoading(false);
    }

    void fetchLinks();
    return () => {
      mounted = false;
    };
  }, [groupId]);

  function openAddDialog() {
    setEditing(null);
    setTitle("");
    setUrl("");
    setDescription("");
    setDialogOpen(true);
  }

  function openEditDialog(link: CircleLink) {
    setEditing(link);
    setTitle(link.title);
    setUrl(link.url);
    setDescription(link.description ?? "");
    setDialogOpen(true);
  }

  function validateInputs() {
    if (!title.trim()) {
      toast.error("Title is required");
      return false;
    }
    if (!url.trim() || !(url.startsWith("http://") || url.startsWith("https://"))) {
      toast.error("URL must start with http:// or https://");
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validateInputs()) return;
    setSaving(true);

    try {
      if (editing) {
        const { error } = await supabase
          .from("circle_links")
          .update({ title: title.trim(), url: url.trim(), description: description.trim() || null, updated_at: new Date().toISOString() })
          .eq("id", editing.id);

        if (error) throw error;
        toast.success("Link updated");
      } else {
        const { data, error } = await supabase
          .from("circle_links")
          .insert({ group_id: groupId, created_by: currentUserId, title: title.trim(), url: url.trim(), description: description.trim() || null })
          .select();
        if (error) throw error;
        toast.success("Link added");
      }

      // refresh
      const { data: refreshed } = await supabase
        .from("circle_links")
        .select("*, profiles(full_name)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      setLinks((refreshed as any) ?? []);
      setDialogOpen(false);
    } catch (e) {
      console.error("[ImportantLinks] save error:", e);
      toast.error("Failed to save link");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("circle_links").delete().eq("id", id);
      if (error) throw error;
      setLinks((current) => current.filter((l) => l.id !== id));
      toast.success("Link deleted");
    } catch (e) {
      console.error("[ImportantLinks] delete error:", e);
      toast.error("Failed to delete link");
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <Card className="rounded-xl border bg-white">
      <CardHeader className="flex items-start justify-between">
        <div>
          <CardTitle>Important Links</CardTitle>
          <CardDescription>Save shared links for quick access by the circle.</CardDescription>
        </div>
        <div className="ml-4">
          <Button size="sm" onClick={openAddDialog} variant="ghost">
            <Plus className="mr-2 h-4 w-4" /> Add link
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : links.length === 0 ? (
          <div className="rounded-lg border-dashed border border-border/60 p-6 text-center">
            <p className="text-sm text-muted-foreground">No links saved yet. Add a Zoom link, Google Drive folder, or any shared resource.</p>
            <div className="mt-4 flex justify-center">
              <Button onClick={openAddDialog}><Plus className="mr-2 h-4 w-4" />Add link</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search links by title or URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3">
            {links.filter(link => 
              link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              link.url.toLowerCase().includes(searchQuery.toLowerCase())
            ).map((link) => (
              <div key={link.id} className={cn("flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 px-4 py-3")}> 
                <div className="mt-0.5 text-zinc-700"><Link2 className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-foreground hover:underline cursor-pointer block truncate max-w-full">{link.title}</a>
                  {link.description ? <div className="text-[11px] text-muted-foreground mt-1 truncate max-w-xs">{link.description}</div> : null}
                  <div className="mt-2 text-[11px] text-muted-foreground">Added by: {link.profiles?.full_name ?? "Unknown"}</div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {currentUserId && currentUserId === link.created_by ? (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openEditDialog(link)} className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 cursor-pointer">
                        <Pencil className="h-4 w-4" />
                      </button>

                      {confirmingId === link.id ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(link.id)}
                            disabled={deletingId === link.id}
                            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs text-red-600 bg-red-50"
                          >
                            <Check className="h-4 w-4" /> Yes
                          </button>
                          <button type="button" onClick={() => setConfirmingId(null)} className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs">
                            <X className="h-4 w-4" /> Cancel
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmingId(link.id)} className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 cursor-pointer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit link" : "Add link"}</DialogTitle>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Zoom meeting" />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">URL</label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" type="url" />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional note" />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
