import Link from "next/link";
import { Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmailShareButton({
  href,
  disabled = false,
  className,
  label = "Send via Email"
}: {
  href?: string | null;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  if (!href || disabled) {
    return (
      <span
        className={buttonVariants({
          variant: "secondary",
          className: cn("pointer-events-none opacity-60", className)
        })}
      >
        <Mail className="mr-2 h-4 w-4" />
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={buttonVariants({ variant: "secondary", className })}
    >
      <Mail className="mr-2 h-4 w-4" />
      {label}
    </Link>
  );
}
