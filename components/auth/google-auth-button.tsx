"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GoogleAuthButton({
  label = "Continue with Google",
  redirectTo = "/dashboard"
}: {
  label?: string;
  redirectTo?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full gap-3 bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signIn("google", { redirectTo });
      }}
    >
      <GoogleMark />
      {pending ? "Opening Google..." : label}
    </Button>
  );
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.22c1.89-1.74 2.99-4.3 2.99-7.52Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.22-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.76-5.59-4.12H3.08v2.59A9.99 9.99 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.41 13.88A6.01 6.01 0 0 1 6.09 12c0-.65.11-1.28.32-1.88V7.53H3.08A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.08 4.47l3.33-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6c1.47 0 2.79.5 3.82 1.5l2.86-2.86C16.95 3.03 14.69 2 12 2a9.99 9.99 0 0 0-8.92 5.53l3.33 2.59C7.2 7.76 9.4 6 12 6Z"
        fill="#EA4335"
      />
    </svg>
  );
}
