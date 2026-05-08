"use client";

import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

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
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Ask for a sprint triage, blocker summary, or next-action plan based on the tracker.",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

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
    <Card className="gap-0 overflow-hidden rounded-lg border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 py-0 shadow-xs">
      <div className="flex items-center gap-2 border-b border-purple-200 px-4 py-3">
        <Bot className="size-4 text-purple-700" />
        <div className="text-sm font-semibold text-purple-800">AI task assistant</div>
      </div>
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto px-4 py-3">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] rounded-lg bg-purple-700 px-3 py-2 text-xs leading-5 text-white"
                  : "max-w-[85%] rounded-lg border border-purple-200 bg-card px-3 py-2 text-xs leading-5"
              }
            >
              {message.text}
            </div>
          </div>
        ))}
        {loading ? <div className="text-xs text-muted-foreground">Thinking...</div> : null}
      </div>
      <div className="grid gap-1.5 px-4 pb-3">
        {messages.length === 1
          ? SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => sendPrompt(suggestion)}
                className="cursor-pointer rounded-md border border-purple-200 bg-card px-3 py-2 text-left text-xs hover:bg-purple-50"
              >
                {suggestion}
              </button>
            ))
          : null}
      </div>
      <form
        className="flex gap-2 border-t border-purple-200 px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void sendPrompt();
        }}
      >
        <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask about sprint priorities..." maxLength={2000} />
        <Button type="submit" disabled={loading || !prompt.trim()} size="icon">
          <Send className="size-4" />
        </Button>
      </form>
    </Card>
  );
}
