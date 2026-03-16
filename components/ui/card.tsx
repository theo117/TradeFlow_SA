import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/70 bg-white/90 p-6 shadow-panel backdrop-blur",
        className
      )}
      {...props}
    />
  );
}
