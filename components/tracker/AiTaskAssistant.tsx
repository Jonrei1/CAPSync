"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, MessageSquareText, Send, X } from "lucide-react";
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
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Floating prompt bubble state
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleHovered, setBubbleHovered] = useState(false);
  const [fabHovered, setFabHovered] = useState(false);
  const bubbleTimeoutRef = useRef<number | null>(null);
  const bubbleIntervalRef = useRef<number | null>(null);

  // Show the bubble every 15s for a short duration, but hide when chat is open
  useEffect(() => {
    // start interval
    bubbleIntervalRef.current = window.setInterval(() => {
      if (!open) {
        setShowBubble(true);
        if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
        bubbleTimeoutRef.current = window.setTimeout(() => setShowBubble(false), 5000);
      }
    }, 15000);

    return () => {
      if (bubbleIntervalRef.current) window.clearInterval(bubbleIntervalRef.current);
      if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
    };
  }, [open]);

  // Ensure bubble hides immediately when chat opens or FAB is hovered
  useEffect(() => {
    if (open || fabHovered) {
      setShowBubble(false);
      if (bubbleTimeoutRef.current) {
        window.clearTimeout(bubbleTimeoutRef.current);
        bubbleTimeoutRef.current = null;
      }
    }
  }, [open, fabHovered]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      const element = messagesContainerRef.current;
      setTimeout(() => {
        element.scrollTop = element.scrollHeight;
        setIsScrolledToBottom(true);
      }, 0);
    }
  }, [messages]);

  // Handle scroll events to show/hide scroll indicator
  function handleScroll() {
    if (messagesContainerRef.current) {
      const element = messagesContainerRef.current;
      const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 50;
      setIsScrolledToBottom(isAtBottom);
    }
  }

  // Scroll to bottom when arrow is clicked
  function scrollToBottom() {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      setIsScrolledToBottom(true);
    }
  }

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
        const is429 = response.status === 429;
        const friendlyMessage = is429
          ? "You've sent a lot of messages recently. Please wait a minute and try again."
          : payload.error ?? "AI assistant failed.";

        toast.error("AI assistant unavailable", friendlyMessage);
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: is429
              ? "⏳ You've hit the rate limit. Please wait a minute before sending another message."
              : "I could not reach the assistant. Check server configuration and try again.",
          },
        ]);
        return;
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

  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* FAB Button */}
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        onMouseEnter={() => {
          setFabHovered(true);
          setShowBubble(false);
          if (bubbleTimeoutRef.current) {
            window.clearTimeout(bubbleTimeoutRef.current);
            bubbleTimeoutRef.current = null;
          }
        }}
        onMouseLeave={() => setFabHovered(false)}
        className={cn(
          "cursor-pointer fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 active:scale-95 hover:scale-105",
          open
            ? "bg-zinc-100 text-zinc-700 shadow-md"
            : "bg-zinc-800 text-white shadow-[0_4px_14px_rgba(39,39,42,0.4)]"
        )}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
      >
        {open ? <X className="size-5 " /> : <MessageSquareText className="size-5" />}
      </button>

      {/* Floating prompt bubble (appears periodically) */}
      {showBubble && !open && !bubbleHovered && !fabHovered && (
        <div
          onMouseEnter={() => setBubbleHovered(true)}
          onMouseLeave={() => setBubbleHovered(false)}
          onClick={() => {
            setOpen(true);
            setShowBubble(false);
          }}
          className="fixed bottom-6 right-20 z-50 flex items-center"
        >
          <div className="rounded-full px-3 py-2 bg-white border border-border/70 text-sm text-zinc-900 shadow-sm transition-all duration-300 transform animate-in fade-in-0 slide-in-from-right-2 hover:scale-105">
            Chat with AI Consultant
          </div>
        </div>
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-20 right-6 z-50 w-80 overflow-hidden rounded-2xl border border-border/70 bg-white shadow-2xl",
          "transition-all duration-200 origin-bottom-right",
          open
            ? "scale-100 opacity-100 pointer-events-auto animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2"
            : "scale-95 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b border-border/70 px-4 py-3 bg-white"
          style={{ borderLeft: "3px solid #52525b" }}
        >
          <div className="flex items-center gap-2 pl-1">
            <Bot className="size-4 text-zinc-700" />
            <div className="text-sm font-semibold text-zinc-900">AI Task Assistant</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-pointer text-zinc-400 hover:text-zinc-600 transition-colors p-1 hover:bg-zinc-100 rounded-md"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Messages Container with Scroll Indicator */}
        <div className="relative flex flex-col">
          {/* Messages */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="max-h-72 overflow-y-auto px-4 py-3 bg-white flex flex-col gap-3"
          >
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[85%] rounded-2xl bg-zinc-900 px-3.5 py-2.5 text-xs leading-5 text-white"
                      : "max-w-[85%] rounded-2xl border border-border/70 bg-white px-3.5 py-2.5 text-xs leading-5 text-foreground"
                  }
                >
                  {message.text}
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex items-center gap-1 px-3 py-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            )}

            {/* Scroll to bottom indicator - absolutely positioned */}
            {!isScrolledToBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="cursor-pointer absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center justify-center h-6 w-6 rounded-full bg-zinc-700 text-white shadow-md hover:bg-zinc-800 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-2"
                aria-label="Scroll to latest messages"
              >
                <ChevronDown className="size-3 animate-bounce" />
              </button>
            )}
          </div>
        </div>

        {/* Suggestion Chips */}
        {messages.length === 1 && (
          <div className="grid gap-2 px-4 py-3 bg-white border-t border-border/70">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => sendPrompt(suggestion)}
                className="w-full rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:border-zinc-300"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form
          className="flex gap-2 border-t border-border/70 px-4 py-3 bg-white"
          onSubmit={(event) => {
            event.preventDefault();
            void sendPrompt();
          }}
        >
          <Input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask about sprint priorities..."
            maxLength={2000}
            className="rounded-full"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
              prompt.trim() && !loading
                ? "bg-zinc-800 text-white hover:bg-zinc-900"
                : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
            )}
          >
            <Send className="size-3.5" />
          </button>
        </form>
      </div>
    </>
  );
}
