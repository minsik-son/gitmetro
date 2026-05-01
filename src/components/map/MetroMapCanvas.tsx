"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type WheelEvent,
} from "react";
import type { CommitNode, GitMetroGraph, MapOrientation } from "@/types/gitmetro";
import { buildLayout, rectPath } from "@/lib/layout/buildLayout";
import type { ThemeTokens } from "@/lib/theme/themes";
import { Station, type NodeStyle } from "./Station";

export interface HoverState {
  commit: CommitNode;
  x: number;
  y: number;
}

interface Props {
  data: GitMetroGraph;
  orientation: MapOrientation;
  nodeStyle: NodeStyle;
  theme: ThemeTokens;
  visibleBranches: Set<string>;
  selectedSha: string | null;
  onSelectCommit: (commit: CommitNode) => void;
  onHoverChange: (state: HoverState | null) => void;
  zoom: number;
  setZoom: (updater: (z: number) => number) => void;
  pan: { x: number; y: number };
  setPan: (next: { x: number; y: number }) => void;
  onClearSelection: () => void;
}

const CLICK_DRAG_THRESHOLD_PX = 5;

export function MetroMapCanvas({
  data,
  orientation,
  nodeStyle,
  theme,
  visibleBranches,
  selectedSha,
  onSelectCommit,
  onHoverChange,
  zoom,
  setZoom,
  pan,
  setPan,
  onClearSelection,
}: Props) {
  const { branches, commits } = data;
  const layout = useMemo(
    () => buildLayout(branches, commits, orientation),
    [branches, commits, orientation],
  );
  const branchById = useMemo(() => {
    const m: Record<string, (typeof branches)[number]> = {};
    branches.forEach((b) => {
      m[b.id] = b;
    });
    return m;
  }, [branches]);

  const branchChains = useMemo(() => {
    const chains: Record<string, CommitNode[]> = {};
    branches.forEach((b) => {
      chains[b.id] = commits
        .filter((c) => c.branch === b.id)
        .sort((a, b) => a.t - b.t);
    });
    return chains;
  }, [branches, commits]);

  const edges = useMemo(() => {
    const e: Array<{
      id: string;
      from: CommitNode;
      to: CommitNode;
      color: string;
    }> = [];
    commits.forEach((c) => {
      c.parents.forEach((psha) => {
        const p = layout.bySha[psha];
        if (!p) return;
        if (p.branch === c.branch && !c.isMerge) return;
        if (c.isMerge && p.branch === c.branch) return;
        e.push({
          id: `${psha}->${c.sha}`,
          from: p,
          to: c,
          color: branchById[p.branch]?.color ?? theme.text,
        });
      });
    });
    return e;
  }, [commits, layout, branchById, theme.text]);

  const drag = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const movedDuringPress = useRef(false);

  const onMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    movedDuringPress.current = false;
    setIsDragging(true);
  };

  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      if (Math.abs(dx) > CLICK_DRAG_THRESHOLD_PX || Math.abs(dy) > CLICK_DRAG_THRESHOLD_PX) {
        drag.current.moved = true;
        movedDuringPress.current = true;
      }
      setPan({
        x: drag.current.panX + dx,
        y: drag.current.panY + dy,
      });
    };
    const onUp = () => {
      drag.current = null;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setPan]);

  const onSvgClick = () => {
    if (movedDuringPress.current) {
      // Mouseup ended a drag — don't treat as background click.
      movedDuringPress.current = false;
      return;
    }
    // Station onClick stops propagation, so reaching here means empty area.
    onHoverChange(null);
    onClearSelection();
  };

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => Math.max(0.5, Math.min(2, z + delta)));
  };

  const showCommit = useCallback(
    (c: CommitNode) => visibleBranches.has(c.branch),
    [visibleBranches],
  );

  function chainPath(chain: CommitNode[]): string {
    if (chain.length < 2) return "";
    const pts = chain.map((c) =>
      layout.pos(c.t, branchById[c.branch].lane),
    );
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  }

  const laneLabels = branches.map((b) => {
    const tStart = branchChains[b.id][0]?.t ?? 0;
    const p = layout.pos(orientation === "horizontal" ? 0 : tStart, b.lane);
    return orientation === "horizontal"
      ? { ...b, lx: 16, ly: p.y }
      : { ...b, lx: p.x, ly: 16 };
  });

  const handleHover = (commit: CommitNode) => (e: MouseEvent<SVGGElement>) => {
    const svg = (e.currentTarget as SVGGElement).ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    onHoverChange({
      commit,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden gm-canvas-grid"
      data-testid="metro-canvas"
      onWheel={onWheel}
      onMouseLeave={() => onHoverChange(null)}
    >
      <svg
        width="100%"
        height="100%"
        onMouseDown={onMouseDown}
        onClick={onSvgClick}
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
        }}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {branches.map((b) => {
            if (!visibleBranches.has(b.id)) return null;
            const chain = branchChains[b.id];
            if (!chain.length) return null;
            const first = chain[0];
            const a = layout.pos(first.t, b.lane);
            return (
              <line
                key={`guide-${b.id}`}
                x1={a.x}
                y1={a.y}
                x2={orientation === "horizontal" ? layout.width - 40 : a.x}
                y2={orientation === "horizontal" ? a.y : layout.height - 40}
                stroke={theme.guide}
                strokeDasharray="2 6"
                strokeWidth={1}
              />
            );
          })}

          {edges.map((ed) => {
            if (
              !visibleBranches.has(ed.from.branch) ||
              !visibleBranches.has(ed.to.branch)
            ) {
              return null;
            }
            const p1 = layout.pos(ed.from.t, branchById[ed.from.branch].lane);
            const p2 = layout.pos(ed.to.t, branchById[ed.to.branch].lane);
            const d = rectPath(p1, p2, orientation);
            return (
              <path
                key={ed.id}
                d={d}
                fill="none"
                stroke={ed.color}
                strokeWidth={theme.lineWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
              />
            );
          })}

          {branches.map((b) => {
            if (!visibleBranches.has(b.id)) return null;
            const chain = branchChains[b.id];
            if (chain.length < 2) return null;
            return (
              <path
                key={`chain-${b.id}`}
                d={chainPath(chain)}
                fill="none"
                stroke={b.color}
                strokeWidth={theme.lineWidth}
                strokeLinecap="round"
                opacity={0.95}
              />
            );
          })}

          {commits.map((c) => {
            if (!showCommit(c)) return null;
            const b = branchById[c.branch];
            const p = layout.pos(c.t, b.lane);
            return (
              <Station
                key={c.sha}
                commit={c}
                pos={p}
                color={b.color}
                nodeStyle={nodeStyle}
                theme={theme}
                selected={c.sha === selectedSha}
                onSelect={() => onSelectCommit(c)}
                onHover={handleHover(c)}
                onHoverEnd={() => onHoverChange(null)}
              />
            );
          })}

          {laneLabels.map(
            (l) =>
              visibleBranches.has(l.id) && (
                <g key={`label-${l.id}`} transform={`translate(${l.lx},${l.ly})`}>
                  <rect
                    x={orientation === "horizontal" ? 0 : -36}
                    y={orientation === "horizontal" ? -14 : 0}
                    width={72}
                    height={22}
                    rx={4}
                    fill={l.color}
                  />
                  <text
                    x={orientation === "horizontal" ? 36 : 0}
                    y={orientation === "horizontal" ? 1 : 14}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontFamily="Inter, sans-serif"
                    fontWeight={600}
                    fontSize={11}
                    fill={theme.labelText}
                    style={{ letterSpacing: "0.02em" }}
                  >
                    {l.name}
                  </text>
                </g>
              ),
          )}
        </g>
      </svg>
    </div>
  );
}
