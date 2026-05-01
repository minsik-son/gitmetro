"use client";

import { useEffect, useMemo, useState } from "react";
import { applyThemeToGraph } from "@/lib/graph/applyTheme";
import { THEMES } from "@/lib/theme/themes";
import type {
  CommitNode,
  GitMetroGraph,
  MapOrientation,
  ThemeKey,
} from "@/types/gitmetro";
import { LoadingTerminal } from "@/components/loading/LoadingTerminal";
import { BranchFilterPanel } from "@/components/filters/BranchFilterPanel";
import { CommitInspector } from "@/components/inspector/CommitInspector";
import { MapToolbar } from "./MapToolbar";
import { MetroMapCanvas, type HoverState } from "./MetroMapCanvas";
import { CommitTooltip } from "./CommitTooltip";
import { ZoomControls } from "./ZoomControls";
import { MapLegend } from "./MapLegend";
import type { NodeStyle } from "./Station";

interface Props {
  graph: GitMetroGraph;
  loadingStepMs?: number;
  skipInitialLoading?: boolean;
  truncated?: boolean;
}

export function MapShell({
  graph,
  loadingStepMs,
  skipInitialLoading = false,
  truncated = false,
}: Props) {
  const [phase, setPhase] = useState<"loading" | "map">(
    skipInitialLoading ? "map" : "loading",
  );
  const [orientation, setOrientation] = useState<MapOrientation>("horizontal");
  const [themeKey, setThemeKey] = useState<ThemeKey>("gitmetro-dark");
  const [nodeStyle] = useState<NodeStyle>("ring");

  const theme = THEMES[themeKey];

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--app", theme.app);
    root.style.setProperty("--panel", theme.panel);
    root.style.setProperty("--panel-alt", theme.panelAlt);
    root.style.setProperty("--border", theme.border);
    root.style.setProperty("--text", theme.text);
    root.style.setProperty("--muted", theme.textMuted);
    root.style.setProperty("--canvas", theme.canvas);
    root.style.setProperty("--guide", theme.guide);
  }, [theme]);

  const themedGraph = useMemo(
    () => applyThemeToGraph(graph, theme),
    [graph, theme],
  );

  const [visibleBranches, setVisibleBranches] = useState<Set<string>>(
    () => new Set(graph.branches.map((b) => b.id)),
  );
  const [showHistory, setShowHistory] = useState(true);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const effectiveVisibleBranches = useMemo(() => {
    if (showHistory) return visibleBranches;
    const next = new Set<string>();
    visibleBranches.forEach((id) => {
      const branch = themedGraph.branches.find((b) => b.id === id);
      if (branch?.isHistorical) return;
      next.add(id);
    });
    return next;
  }, [visibleBranches, showHistory, themedGraph.branches]);

  function toggleBranch(id: string) {
    setVisibleBranches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelect(commit: CommitNode) {
    setSelectedSha(commit.sha);
  }

  if (phase === "loading") {
    return (
      <LoadingTerminal
        repoLabel={`${graph.repo.owner}/${graph.repo.name}`}
        onDone={() => setPhase("map")}
        stepIntervalMs={loadingStepMs}
      />
    );
  }

  const selectedCommit = selectedSha
    ? themedGraph.commits.find((c) => c.sha === selectedSha) ?? null
    : null;

  return (
    <div className="flex h-screen flex-col">
      <MapToolbar
        repo={themedGraph.repo}
        orientation={orientation}
        setOrientation={setOrientation}
        themeKey={themeKey}
        setThemeKey={setThemeKey}
        truncated={truncated}
      />
      <div className="flex min-h-0 flex-1">
        <BranchFilterPanel
          branches={themedGraph.branches}
          visible={visibleBranches}
          toggle={toggleBranch}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
        />
        <div className="relative min-w-0 flex-1">
          <MetroMapCanvas
            data={themedGraph}
            orientation={orientation}
            nodeStyle={nodeStyle}
            theme={theme}
            visibleBranches={effectiveVisibleBranches}
            selectedSha={selectedSha}
            onSelectCommit={handleSelect}
            onHoverChange={setHover}
            zoom={zoom}
            setZoom={(updater) => setZoom((z) => updater(z))}
            pan={pan}
            setPan={setPan}
            onClearSelection={() => {
              setSelectedSha(null);
              setHover(null);
            }}
          />
          {hover && <CommitTooltip hover={hover} />}
          <ZoomControls
            zoom={zoom}
            setZoom={(updater) => setZoom((z) => updater(z))}
            setPan={setPan}
          />
          <MapLegend theme={theme} />
        </div>
        {selectedCommit && (
          <CommitInspector
            commit={selectedCommit}
            graph={themedGraph}
            onSelectSha={setSelectedSha}
          />
        )}
      </div>
    </div>
  );
}
