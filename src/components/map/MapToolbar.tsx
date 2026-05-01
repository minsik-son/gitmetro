"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { BranchIcon, ExportIcon, GhIcon } from "@/components/ui/icons";
import { OrientationToggle } from "./OrientationToggle";
import { ThemeSelector } from "./ThemeSelector";
import type { MapOrientation, RepositorySummary, ThemeKey } from "@/types/gitmetro";

interface Props {
  repo: RepositorySummary;
  orientation: MapOrientation;
  setOrientation: (next: MapOrientation) => void;
  themeKey: ThemeKey;
  setThemeKey: (next: ThemeKey) => void;
  truncated?: boolean;
}

export function MapToolbar({
  repo,
  orientation,
  setOrientation,
  themeKey,
  setThemeKey,
  truncated = false,
}: Props) {
  const githubUrl = `https://github.com/${repo.owner}/${repo.name}`;
  return (
    <div className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2">
      <Link href="/" aria-label="New repo" className="rounded-md p-1 hover:bg-panel-alt">
        <Logo />
      </Link>
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted">{repo.owner}</span>
        <span className="text-muted">/</span>
        <span className="font-semibold">{repo.name}</span>
        <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-line bg-panel-alt px-2 py-0.5 font-mono text-[11px] text-muted">
          <BranchIcon /> {repo.defaultBranch}
        </span>
      </div>
      {repo.commitsTotal != null && (
        <>
          <span className="text-muted">·</span>
          <span className="text-xs text-muted">
            {repo.commitsTotal.toLocaleString()} commits
          </span>
        </>
      )}
      {repo.lastSync && (
        <>
          <span className="text-muted">·</span>
          <span className="text-xs text-muted">last sync {repo.lastSync}</span>
        </>
      )}
      {truncated && (
        <span
          data-testid="truncated-pill"
          title="Some branches or commits were omitted because of fetch limits."
          className="ml-2 inline-flex items-center rounded-full border border-line bg-panel-alt px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#ff9f43]"
        >
          truncated
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <OrientationToggle value={orientation} onChange={setOrientation} />
        <ThemeSelector value={themeKey} onChange={setThemeKey} />
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-alt px-2.5 py-1 text-xs text-muted transition hover:text-text"
        >
          <ExportIcon /> Export
        </button>
        <a
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-alt px-2.5 py-1 text-xs text-muted transition hover:text-text"
        >
          <GhIcon /> Open on GitHub
        </a>
      </div>
    </div>
  );
}
