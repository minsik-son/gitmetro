"use client";

import { GhIcon } from "@/components/ui/icons";

export function GitHubSignInButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // OAuth route will be added in a later phase. Stub action for now.
      }}
      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-medium text-text transition hover:bg-panel-alt"
    >
      <GhIcon /> Sign in with GitHub
    </button>
  );
}
