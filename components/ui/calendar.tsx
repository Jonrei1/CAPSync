"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "space-y-4",
        month_caption: "relative flex h-9 items-center justify-center px-10",
        caption_label: "text-sm font-medium text-foreground flex-1 text-center",
        dropdowns: "flex items-center justify-center gap-1.5 text-sm font-medium",
        dropdown_root:
          "relative border-0 bg-transparent px-1 py-0.5 shadow-none [&_.rdp-chevron]:hidden",
        dropdown: "absolute inset-0 cursor-pointer opacity-0",
        months_dropdown: "text-sm font-medium text-foreground",
        years_dropdown: "text-sm font-medium text-foreground",
        nav: "pointer-events-none absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between px-1",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "pointer-events-auto size-8 rounded-md bg-transparent p-0 text-muted-foreground hover:text-foreground",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "pointer-events-auto size-8 rounded-md bg-transparent p-0 text-muted-foreground hover:text-foreground",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-9 rounded-md text-[0.8rem] font-normal",
        week: "mt-1 flex w-full",
        day: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
        ),
        day_button: "h-9 w-9 rounded-md p-0",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground font-semibold ring-1 ring-primary/35",
        outside:
          "text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: iconClassName, ...iconProps }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...iconProps} />;
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("h-4 w-4", iconClassName)} {...iconProps} />;
          }
          return <ChevronRight className={cn("h-4 w-4", iconClassName)} {...iconProps} />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
