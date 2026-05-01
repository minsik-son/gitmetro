"use client";

import type { CommitNode } from "@/types/gitmetro";

interface Props {
  hover: { commit: CommitNode; x: number; y: number };
}

export function CommitTooltip({ hover }: Props) {
  const c = hover.commit;
  return (
    <div
      role="tooltip"
      data-testid="commit-tooltip"
      className="pointer-events-none absolute z-20 max-w-xs rounded-md border border-line bg-panel-alt px-3 py-2 text-xs shadow-lg"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
    >
      <div className="flex items-center gap-2">
        <code className="font-mono text-[12px] font-semibold text-text">
          {c.shortSha}
        </code>
        {c.isMerge && (
          <span className="rounded bg-[#1f2530] px-1.5 py-0.5 font-mono text-[10px] text-[#3ddbd9]">
            merge
          </span>
        )}
        {c.tag && (
          <span className="rounded bg-[#1f2530] px-1.5 py-0.5 font-mono text-[10px] text-[#f3d54e]">
            {c.tag}
          </span>
        )}
      </div>
      <div className="mt-1 text-text">{c.message}</div>
      <div className="mt-1 flex flex-wrap gap-1 text-muted">
        <span>{c.author}</span>
        <span>·</span>
        <span>{c.date}</span>
        {c.files != null && (
          <>
            <span>·</span>
            <span>{c.files} files</span>
          </>
        )}
      </div>
    </div>
  );
}
