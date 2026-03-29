import * as React from "react";
import { cn } from "@/lib/utils";

function Avatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-center rounded-full text-white font-semibold", className)}
      {...props}
    />
  );
}

export { Avatar };
