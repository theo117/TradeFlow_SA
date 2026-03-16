import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 invalid:border-rose-300 invalid:bg-rose-50/60 invalid:text-rose-900 invalid:focus:border-rose-400 invalid:focus:ring-rose-100",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
