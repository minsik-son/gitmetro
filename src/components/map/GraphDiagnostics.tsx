"use client";

import { useState } from "react";
import type { GraphMeta } from "@/lib/github/api-types";

interface Props {
  meta: GraphMeta;
}

export function GraphDiagnostics({ meta }: Props) {
  const [open, setOpen] = useState(false);

  const mergeLanes = meta.history.historicalBranches;
  const prLanes = meta.prHistory?.branches ?? 0;
  const fetchedPulls = meta.prHistory?.fetchedPulls ?? 0;
  const fetchedPullCommits = meta.prHistory?.fetchedPullCommits ?? 0;
  const prMode = meta.prHistory?.mode;
  const virtualNodes = meta.prHistory?.virtualNodes;
  const branchOffEdges = meta.prHistory?.branchOffEdges;
  const mergeBackEdges = meta.prHistory?.mergeBackEdges;
  const warnings = meta.warnings;
  const rateRemaining = meta.rateLimit?.remaining;

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="diagnostics-pill"
        onClick={() => setOpen((v) => !v)}
        title="Open diagnostics"
        className="inline-flex items-center gap-1 rounded-full border border-line bg-panel-alt px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted transition hover:text-text"
      >
        info
      </button>
      {open && (
        <div
          data-testid="diagnostics-popover"
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-md border border-line bg-panel p-3 text-xs text-text shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wider text-muted">
              Graph diagnostics
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted hover:text-text"
              aria-label="Close diagnostics"
            >
              ×
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-y-1 text-[11px]">
            <dt className="text-muted">Selected branches</dt>
            <dd className="text-right font-mono">{meta.selectedBranches}</dd>

            <dt className="text-muted">Fetched commits</dt>
            <dd className="text-right font-mono">{meta.fetchedCommits}</dd>

            <dt className="text-muted">Merge lanes</dt>
            <dd className="text-right font-mono">{mergeLanes}</dd>

            <dt className="text-muted">PR lanes</dt>
            <dd className="text-right font-mono">{prLanes}</dd>

            {prMode && (
              <>
                <dt className="text-muted">PR mode</dt>
                <dd className="text-right font-mono">{prMode}</dd>
              </>
            )}

            {virtualNodes != null && (
              <>
                <dt className="text-muted">Virtual nodes</dt>
                <dd className="text-right font-mono">{virtualNodes}</dd>
              </>
            )}

            {branchOffEdges != null && (
              <>
                <dt className="text-muted">Branch-off</dt>
                <dd className="text-right font-mono">{branchOffEdges}</dd>
              </>
            )}

            {mergeBackEdges != null && (
              <>
                <dt className="text-muted">Merge-back</dt>
                <dd className="text-right font-mono">{mergeBackEdges}</dd>
              </>
            )}

            {meta.prHistory?.enabled && (
              <>
                <dt className="text-muted">PR commits</dt>
                <dd className="text-right font-mono">
                  {fetchedPulls} / {fetchedPullCommits}
                </dd>
              </>
            )}

            {rateRemaining != null && (
              <>
                <dt className="text-muted">Rate limit left</dt>
                <dd className="text-right font-mono">{rateRemaining}</dd>
              </>
            )}
          </dl>

          {warnings.length > 0 && (
            <div className="mt-3 border-t border-line pt-2">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">
                Warnings
              </div>
              <ul className="space-y-1 text-[11px] text-muted">
                {warnings.map((w, i) => (
                  <li key={i} className="break-words">
                    • {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
