"use client";

import Link from "next/link";
import type { GraphApiFailure } from "@/lib/github/api-types";

interface Props {
  error: GraphApiFailure["error"];
  owner: string;
  repo: string;
  onRetry: () => void;
}

const FRIENDLY: Record<GraphApiFailure["error"]["code"], string> = {
  invalid_request: "The repository identifier looks invalid.",
  not_found: "We couldn't find that repository on GitHub.",
  forbidden: "GitHub denied access. The repository may be private.",
  rate_limited:
    "GitHub API rate limit reached. Try again later or set GITHUB_TOKEN.",
  github_unavailable: "GitHub is temporarily unreachable.",
  empty_graph: "This repository has no branches or commits to render.",
  unknown: "Something went wrong while contacting GitHub.",
};

export function GitHubGraphError({ error, owner, repo, onRetry }: Props) {
  const friendly = FRIENDLY[error.code] ?? FRIENDLY.unknown;
  return (
    <div
      data-testid="github-graph-error"
      className="flex min-h-screen items-center justify-center px-6 py-10"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-md border border-line bg-panel">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <span className="block h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="block h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="block h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-[11px] text-muted">
            gitmetro@core — error
          </span>
          <span className="ml-auto font-mono text-[11px] text-muted">
            HTTP {error.status} · {error.code}
          </span>
        </div>
        <div className="px-4 py-4">
          <div className="font-mono text-[12px] text-text">
            <span className="text-[#ff5b5b]">✗</span> {friendly}
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted">
            target: {owner}/{repo}
          </div>
          {error.resetAt && (
            <div className="mt-1 font-mono text-[11px] text-muted">
              rate limit resets at {error.resetAt}
            </div>
          )}
          {error.message && error.message !== friendly && (
            <pre className="mt-3 overflow-x-auto rounded border border-line bg-panel-alt px-3 py-2 font-mono text-[11px] text-muted">
              {error.message}
            </pre>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-line bg-panel-alt px-3 py-1.5 text-xs text-text transition hover:bg-panel"
            >
              Retry
            </button>
            <Link
              href="/"
              className="rounded-md border border-line bg-panel-alt px-3 py-1.5 text-xs text-text transition hover:bg-panel"
            >
              Back to entry
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
