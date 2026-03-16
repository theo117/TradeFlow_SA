import Link from "next/link";
import { MessageCircleMore } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WhatsAppShareButton({
  href,
  disabled = false,
  className
}: {
  href?: string | null;
  disabled?: boolean;
  className?: string;
}) {
  if (!href || disabled) {
    return (
      <span
        className={buttonVariants({
          variant: "secondary",
          className: cn("pointer-events-none opacity-60", className)
        })}
      >
        <MessageCircleMore className="mr-2 h-4 w-4" />
        Send via WhatsApp
      </span>
    );
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className={buttonVariants({ variant: "secondary", className })}
    >
      <MessageCircleMore className="mr-2 h-4 w-4" />
      Send via WhatsApp
    </Link>
  );
}
