import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-[linear-gradient(110deg,rgba(226,232,240,0.72),rgba(248,250,252,0.96),rgba(226,232,240,0.72))] bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  );
}
