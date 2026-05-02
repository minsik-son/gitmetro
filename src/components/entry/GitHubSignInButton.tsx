"use client";

import { GhIcon } from "@/components/ui/icons";

interface Props {
  returnTo?: string;
  className?: string;
}

export function GitHubSignInButton({ returnTo, className }: Props = {}) {
  const href = returnTo
    ? `/api/auth/github/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/api/auth/github/login";
  return (
    <a
      href={href}
      data-testid="github-sign-in-button"
      className={
        className ??
        "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-medium text-text transition hover:bg-panel-alt"
      }
    >
      <GhIcon /> Sign in with GitHub
    </a>
  );
}
