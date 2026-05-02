"use client";

import type { CommitNode, GitMetroGraph } from "@/types/gitmetro";
import { getVisualNodeId } from "@/lib/graph/visualNode";

interface Props {
  commit: CommitNode;
  graph: GitMetroGraph;
  onSelectSha: (key: string) => void;
}

export function CommitInspector({ commit, graph, onSelectSha }: Props) {
  const branch = graph.branches.find((b) => b.id === commit.branch);
  const parents = commit.parents
    .map((p) =>
      graph.commits.find((c) => getVisualNodeId(c) === p || c.sha === p),
    )
    .filter((c): c is CommitNode => !!c);

  if (!branch) return null;

  return (
    <aside
      data-testid="commit-inspector"
      className="flex w-[320px] flex-col gap-3 overflow-y-auto border-l border-line bg-panel px-4 py-4"
    >
      <div className="text-[11px] uppercase tracking-wider text-muted">
        Selected commit
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-panel-alt px-2 py-0.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: branch.color }}
          />
          <code className="font-mono text-[12px] text-text">{commit.shortSha}</code>
        </span>
        {commit.isMerge && (
          <span className="rounded-full bg-panel-alt px-2 py-0.5 font-mono text-[10px] text-[#3ddbd9]">
            merge
          </span>
        )}
        {commit.isHead && (
          <span className="rounded-full bg-panel-alt px-2 py-0.5 font-mono text-[10px] text-[#ff9f43]">
            HEAD
          </span>
        )}
        {commit.tag && (
          <span className="rounded-full bg-panel-alt px-2 py-0.5 font-mono text-[10px] text-[#f3d54e]">
            {commit.tag}
          </span>
        )}
      </div>

      <p className="text-sm text-text">{commit.message}</p>

      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[10px] font-semibold text-app"
          style={{ background: branch.color }}
        >
          {commit.avatar}
        </div>
        <div>
          <div className="text-xs font-semibold text-text">{commit.author}</div>
          <div className="text-[11px] text-muted">{commit.date}</div>
        </div>
      </div>

      <div className="h-px w-full bg-line" />

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[11px] text-muted">Branch</div>
          <div className="mt-0.5 inline-flex items-center gap-1.5 font-semibold">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: branch.color }}
            />
            {branch.name}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted">Files</div>
          <div className="mt-0.5 font-semibold">{commit.files ?? "—"}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted">Parents</div>
          <div className="mt-0.5 font-semibold">{parents.length}</div>
        </div>
        {commit.pr && (
          <div>
            <div className="text-[11px] text-muted">PR</div>
            <div className="mt-0.5 font-semibold">{commit.pr}</div>
          </div>
        )}
      </div>

      {parents.length > 0 && (
        <>
          <div className="h-px w-full bg-line" />
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">
              Parents
            </div>
            <div className="flex flex-col gap-1">
              {parents.map((p) => {
                const pBranch = graph.branches.find((b) => b.id === p.branch);
                const key = getVisualNodeId(p);
                return (
                  <button
                    key={key}
                    onClick={() => onSelectSha(key)}
                    className="flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition hover:bg-panel-alt"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: pBranch?.color ?? "currentColor" }}
                    />
                    <code className="font-mono text-[11px] text-muted">
                      {p.shortSha}
                    </code>
                    <span className="truncate text-text">{p.message}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
