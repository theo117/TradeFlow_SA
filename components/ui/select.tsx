import { SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 invalid:border-rose-300 invalid:bg-rose-50/60 invalid:text-rose-900 invalid:focus:border-rose-400 invalid:focus:ring-rose-100",
        className
      )}
      {...props}
    />
  )
);

Select.displayName = "Select";
