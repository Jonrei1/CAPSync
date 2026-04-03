"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({ className, checked, defaultChecked, onCheckedChange, ...props }: React.ComponentProps<"input"> & {
  onCheckedChange?: (checked: boolean) => void;
}) {
  const [internalChecked, setInternalChecked] = React.useState(Boolean(defaultChecked));
  const isControlled = checked !== undefined;
  const resolvedChecked = isControlled ? Boolean(checked) : internalChecked;

  return (
    <span className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-foreground", className)}>
      <input
        type="checkbox"
        checked={resolvedChecked}
        onChange={(event) => {
          const next = event.target.checked;
          if (!isControlled) {
            setInternalChecked(next);
          }
          onCheckedChange?.(next);
          props.onChange?.(event);
        }}
        className="peer sr-only"
        {...props}
      />
      <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-md border border-border bg-background text-primary shadow-xs transition-colors peer-checked:border-primary peer-checked:bg-primary">
        <Check className="size-3 text-primary-foreground opacity-0 peer-checked:opacity-100" />
      </span>
    </span>
  );
}

export { Checkbox };
