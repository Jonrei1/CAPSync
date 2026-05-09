"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function Dialog({ open, onOpenChange, children }: React.ComponentProps<"div"> & DialogContextValue) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

function DialogTrigger({ children, asChild = false, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const context = React.useContext(DialogContext);
  if (!context) {
    return null;
  }

  const handleClick = () => context.onOpenChange(true);

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: React.MouseEventHandler }>;
    return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
      ...props,
      onClick: (event: React.MouseEvent) => {
        child.props.onClick?.(event);
        handleClick();
      },
    });
  }

  return (
    <button type="button" {...props} onClick={handleClick}>
      {children}
    </button>
  );
}

function DialogContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const context = React.useContext(DialogContext);
  const [mounted, setMounted] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const pointerDownStartedInsideRef = React.useRef(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useEffect(() => {
    if (!context?.open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        context.onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [context]);

  React.useEffect(() => {
    if (!context) return;

    if (!context.open) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Prevent background scrolling and avoid layout shift by compensating for scrollbar width.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [context]);

  if (!context?.open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto bg-black/55 px-3 py-4 backdrop-blur-[2px] sm:items-center sm:px-4"
      onPointerDown={(event) => {
        // Record whether the pointerdown started inside the dialog content.
        pointerDownStartedInsideRef.current = !!contentRef.current?.contains(event.target as Node);
      }}
      onClick={(event) => {
        // Only close when the click started on the backdrop (not when it started inside the dialog and released outside,
        // which happens when selecting text and releasing the mouse outside).
        if (event.target === event.currentTarget && !pointerDownStartedInsideRef.current) {
          context.onOpenChange(false);
        }
        // Reset flag after handling the click.
        pointerDownStartedInsideRef.current = false;
      }}
    >
      <div
        ref={contentRef}
        className={cn(
          "relative w-full max-w-3xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl",
          className,
        )}
        {...props}
      >
        <button
          type="button"
          onClick={() => context.onOpenChange(false)}
          className="absolute top-3 right-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-4 pt-5 pb-3 pr-14 sm:px-6", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-[16px] font-semibold tracking-tight text-foreground", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex justify-end gap-2 border-t pt-3", className)} {...props} />;
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("max-h-[calc(100vh-9rem)] overflow-y-auto px-4 pb-4 sm:px-6", className)} {...props} />;
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody };
