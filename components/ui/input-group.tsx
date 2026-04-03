"use client";

import * as React from "react";
import type { VariantProps } from "class-variance-authority";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ButtonVariants = VariantProps<typeof buttonVariants>;

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="input-group" className={cn("flex w-full items-stretch", className)} {...props} />;
}

function InputGroupInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="input-group-input"
      className={cn(
        "h-9 rounded-r-none border-r-0 text-sm shadow-none focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  );
}

type InputGroupAddonProps = React.ComponentProps<"div"> & {
  align?: "inline-start" | "inline-end";
};

function InputGroupAddon({ className, align = "inline-end", ...props }: InputGroupAddonProps) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "flex items-center border border-input bg-background px-1",
        align === "inline-start" ? "rounded-l-md border-r-0" : "rounded-r-md border-l-0",
        className,
      )}
      {...props}
    />
  );
}

type InputGroupButtonProps = React.ComponentProps<typeof Button> & {
  variant?: ButtonVariants["variant"];
  size?: ButtonVariants["size"];
};

function InputGroupButton({ className, variant = "ghost", size = "icon-xs", ...props }: InputGroupButtonProps) {
  return (
    <Button
      data-slot="input-group-button"
      variant={variant}
      size={size}
      className={cn("h-7 w-7 rounded-sm", className)}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput };
