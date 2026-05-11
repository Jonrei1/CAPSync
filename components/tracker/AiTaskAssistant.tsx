"use client";

import { useEffect, useState } from "react";
import { Bot, MessageSquareText, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type Message = {
  role: "assistant" | "user";
  text: string;
};

type AiTaskAssistantProps = {
  groupId: string;
};

const SUGGESTIONS = [
  "What should we finish before the next adviser check-in?",
  "Summarize blockers from overdue tasks.",
  "Suggest three next actions for this sprint.",
];

export default function AiTaskAssistant({ groupId }: AiTaskAssistantProps) {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Ask for a sprint triage, blocker summary, or next-action plan based on the tracker.",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function sendPrompt(value = prompt) {
    const nextPrompt = value.trim();
    if (!nextPrompt || loading) {
      return;
    }

    setPrompt("");
    setMessages((current) => [...current, { role: "user", text: nextPrompt }]);
    setLoading(true);

    try {
      const response = await fetch("/api/tracker/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, prompt: nextPrompt }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "AI assistant failed.");
      }

      setMessages((current) => [...current, { role: "assistant", text: payload.message ?? "No response received." }]);
    } catch (error) {
      toast.error("AI assistant unavailable", error instanceof Error ? error.message : "Please try again later.");
      setMessages((current) => [
        ...current,
        { role: "assistant", text: "I could not reach the assistant. Check server configuration and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {mounted && (
        <>
          <Button
            onClick={() => setOpen((current) => !current)}
            size="icon-lg"
            className={cn(
              "fixed bottom-6 right-6 z-50 cursor-pointer rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95",
              open && "bg-purple-700 hover:bg-purple-800"
            )}
          >
            {open ? <X className="size-5 text-white" /> : <MessageSquareText className="size-5" />}
          </Button>

          <div
            className={cn(
              "fixed bottom-20 right-6 z-50 flex w-[360px] origin-bottom-right flex-col gap-0 overflow-hidden rounded-xl border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 py-0 shadow-2xl transition-all duration-200",
              open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
            )}
          >
        <div className="flex items-center justify-between border-b border-purple-200 px-4 py-3 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-purple-700" />
            <div className="text-sm font-semibold text-purple-800">AI Task Assistant</div>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={() => setOpen(false)} className="text-purple-700 hover:bg-purple-100/50">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex max-h-96 min-h-64 flex-col gap-2 overflow-y-auto px-4 py-3 bg-white/30">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-purple-700 px-3.5 py-2.5 text-xs leading-5 text-white shadow-sm"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm border border-purple-200 bg-card px-3.5 py-2.5 text-xs leading-5 shadow-sm"
                }
              >
                {message.text}
              </div>
            </div>
          ))}
          {loading ? <div className="text-xs text-muted-foreground animate-pulse ml-2">Thinking...</div> : null}
        </div>
        <div className="grid gap-1.5 px-4 pb-3 bg-white/30">
          {messages.length === 1
            ? SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendPrompt(suggestion)}
                  className="cursor-pointer rounded-lg border border-purple-200 bg-card/80 px-3 py-2 text-left text-xs transition-colors hover:bg-purple-50 hover:text-purple-900 shadow-xs"
                >
                  {suggestion}
                </button>
              ))
            : null}
        </div>
        <form
          className="flex gap-2 border-t border-purple-200 px-4 py-3 bg-white/50 backdrop-blur-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void sendPrompt();
          }}
        >
          <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask about sprint priorities..." maxLength={2000} className="rounded-full bg-white/80" />
          <Button type="submit" disabled={loading || !prompt.trim()} size="icon" className="rounded-full shrink-0 shadow-sm">
            <Send className="size-4" />
          </Button>
        </form>
      </div>
        </>
      )}
    </>
  );
}
