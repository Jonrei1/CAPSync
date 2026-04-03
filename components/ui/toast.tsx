"use client";

import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

function Toaster() {
  const { toasts } = useToast();

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-90 flex w-[min(100vw-2rem,24rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur",
            toast.variant === "success"
              ? "border-green-300 bg-green-50 text-green-900"
              : toast.variant === "error"
                ? "border-red-300 bg-red-50 text-red-900"
                : "border-border bg-background text-foreground",
          )}
        >
          <div className="text-sm font-medium">{toast.title}</div>
          {toast.description ? <div className="mt-1 text-xs text-muted-foreground">{toast.description}</div> : null}
        </div>
      ))}
    </div>
  );
}

export { Toaster };
