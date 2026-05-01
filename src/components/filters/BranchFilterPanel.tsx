"use client";

import { useMemo, useState } from "react";
import { EyeIcon, EyeOffIcon, SearchIcon } from "@/components/ui/icons";
import type { BranchCategory, BranchLine } from "@/types/gitmetro";

interface Props {
  branches: BranchLine[];
  visible: Set<string>;
  toggle: (id: string) => void;
  showHistory: boolean;
  setShowHistory: (next: boolean) => void;
}

const CATEGORY_ORDER: BranchCategory[] = [
  "main",
  "develop",
  "feature",
  "hotfix",
  "release",
  "other",
];

const CATEGORY_LABEL: Record<BranchCategory, string> = {
  main: "Main",
  develop: "Develop",
  feature: "Feature",
  hotfix: "Hotfix",
  release: "Release",
  other: "Other",
};

interface BranchRowProps {
  branch: BranchLine;
  on: boolean;
  onToggle: () => void;
  badge?: string;
}

function BranchRow({ branch, on, onToggle, badge }: BranchRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition ${
        on ? "text-text hover:bg-panel-alt" : "text-muted opacity-60 hover:opacity-100"
      }`}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: branch.color }}
      />
      <span className="flex-1 truncate font-mono">{branch.name}</span>
      {badge && (
        <span className="rounded bg-panel-alt px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
          {badge}
        </span>
      )}
      <span className={on ? "text-text" : "text-muted"}>
        {on ? <EyeIcon /> : <EyeOffIcon />}
      </span>
    </button>
  );
}

export function BranchFilterPanel({
  branches,
  visible,
  toggle,
  showHistory,
  setShowHistory,
}: Props) {
  const [filter, setFilter] = useState("");

  const { grouped, historical } = useMemo(() => {
    const g: Record<BranchCategory, BranchLine[]> = {
      main: [],
      develop: [],
      feature: [],
      hotfix: [],
      release: [],
      other: [],
    };
    const h: BranchLine[] = [];
    branches
      .filter((b) => b.name.toLowerCase().includes(filter.toLowerCase()))
      .forEach((b) => {
        if (b.isHistorical) {
          h.push(b);
        } else {
          g[b.category].push(b);
        }
      });
    return { grouped: g, historical: h };
  }, [branches, filter]);

  return (
    <aside className="flex w-64 flex-col gap-4 overflow-y-auto border-r border-line bg-panel px-3 py-4">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Branches
        </div>
        <div className="flex items-center gap-2 rounded-md border border-line bg-panel-alt px-2 py-1.5">
          <SearchIcon />
          <input
            placeholder="Filter branches…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 bg-transparent text-xs text-text outline-none placeholder:text-muted"
          />
        </div>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const list = grouped[cat];
        if (!list.length) return null;
        return (
          <div key={cat}>
            <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted">
              <span>{CATEGORY_LABEL[cat]}</span>
              <span>{list.length}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {list.map((b) => (
                <BranchRow
                  key={b.id}
                  branch={b}
                  on={visible.has(b.id)}
                  onToggle={() => toggle(b.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {historical.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted">
            <span>History</span>
            <span>{historical.length}</span>
          </div>
          <div className={`flex flex-col gap-0.5 ${showHistory ? "" : "opacity-40"}`}>
            {historical.map((b) => (
              <BranchRow
                key={b.id}
                branch={b}
                on={visible.has(b.id) && showHistory}
                onToggle={() => toggle(b.id)}
                badge={b.pullNumber ? `PR #${b.pullNumber}` : "history"}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">
          Display
        </div>
        <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs text-text">
          <input
            type="checkbox"
            data-testid="show-history-toggle"
            checked={showHistory}
            onChange={(e) => setShowHistory(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#ff5b5b]"
          />
          <span>Show branch history</span>
        </label>
      </div>

      <div>
        <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">
          Timeline
        </div>
        <div className="rounded-md border border-line bg-panel-alt px-3 py-3">
          <div className="relative h-1 rounded bg-line">
            <div
              className="absolute left-2 right-3 top-0 h-1 rounded bg-[#ff5b5b]"
              aria-hidden
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
            <span>Feb 4</span>
            <span>Apr 10</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
