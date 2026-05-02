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
import type {
  CommitNode,
  GitMetroGraph,
  GraphEdge,
  MapOrientation,
} from "@/types/gitmetro";
import { buildLayout, rectPath } from "@/lib/layout/buildLayout";
import { getVisualNodeId } from "@/lib/graph/visualNode";
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
  selectedKey: string | null;
  onSelectCommit: (commit: CommitNode) => void;
  onHoverChange: (state: HoverState | null) => void;
  zoom: number;
  setZoom: (updater: (z: number) => number) => void;
  pan: { x: number; y: number };
  setPan: (next: { x: number; y: number }) => void;
  onClearSelection: () => void;
}

const CLICK_DRAG_THRESHOLD_PX = 5;

interface SyntheticEdgeStyle {
  dashArray?: string;
  opacity: number;
  testIdPrefix: string;
}

const SYNTHETIC_EDGE_STYLES: Record<string, SyntheticEdgeStyle> = {
  "synthetic-pr": {
    dashArray: "6 5",
    opacity: 0.65,
    testIdPrefix: "synthetic-edge",
  },
  "pr-branch-off": {
    dashArray: "5 4",
    opacity: 0.55,
    testIdPrefix: "pr-branch-off-edge",
  },
  "pr-merge-back": {
    dashArray: "5 4",
    opacity: 0.65,
    testIdPrefix: "pr-merge-back-edge",
  },
  "pr-chain": {
    opacity: 0.9,
    testIdPrefix: "pr-chain-edge",
  },
};

function visualT(c: CommitNode): number {
  return c.displayT ?? c.t;
}

export function MetroMapCanvas({
  data,
  orientation,
  nodeStyle,
  theme,
  visibleBranches,
  selectedKey,
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
        .sort((a, b) => visualT(a) - visualT(b));
    });
    return chains;
  }, [branches, commits]);

  const resolveNode = useCallback(
    (key: string): CommitNode | undefined =>
      layout.byNodeId[key] ?? layout.bySha[key],
    [layout],
  );

  const parentEdges = useMemo(() => {
    const e: Array<{
      id: string;
      from: CommitNode;
      to: CommitNode;
      color: string;
    }> = [];
    commits.forEach((c) => {
      // Visual-only nodes (PR commits, virtual start/end) carry explicit
      // GraphEdges in data.edges, so skip parent-based edge generation here.
      if (c.nodeId) return;
      c.parents.forEach((psha) => {
        const p = resolveNode(psha);
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
  }, [commits, resolveNode, branchById, theme.text]);

  const syntheticEdges = useMemo(() => {
    const list: GraphEdge[] = data.edges ?? [];
    return list
      .map((edge) => {
        const style = SYNTHETIC_EDGE_STYLES[edge.type];
        if (!style) return null;
        const from = resolveNode(edge.from);
        const to = resolveNode(edge.to);
        if (!from || !to) return null;
        const branch = edge.branchId ? branchById[edge.branchId] : undefined;
        const color = branch?.color ?? edge.color ?? theme.text;
        return {
          id: edge.id,
          type: edge.type,
          from,
          to,
          color,
          branchId: edge.branchId,
          style,
        };
      })
      .filter(
        (
          v,
        ): v is {
          id: string;
          type: GraphEdge["type"];
          from: CommitNode;
          to: CommitNode;
          color: string;
          branchId: string | undefined;
          style: SyntheticEdgeStyle;
        } => v !== null,
      );
  }, [data.edges, resolveNode, branchById, theme.text]);

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
      layout.posForCommit(c, branchById[c.branch].lane),
    );
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  }

  const laneLabels = branches.map((b) => {
    const tStart = branchChains[b.id][0] ? visualT(branchChains[b.id][0]) : 0;
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
            const a = layout.posForCommit(first, b.lane);
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

          {parentEdges.map((ed) => {
            if (
              !visibleBranches.has(ed.from.branch) ||
              !visibleBranches.has(ed.to.branch)
            ) {
              return null;
            }
            const p1 = layout.posForCommit(
              ed.from,
              branchById[ed.from.branch].lane,
            );
            const p2 = layout.posForCommit(
              ed.to,
              branchById[ed.to.branch].lane,
            );
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

          {syntheticEdges.map((ed) => {
            if (ed.branchId && !visibleBranches.has(ed.branchId)) return null;
            if (
              !visibleBranches.has(ed.from.branch) ||
              !visibleBranches.has(ed.to.branch)
            ) {
              return null;
            }
            const p1 = layout.posForCommit(
              ed.from,
              branchById[ed.from.branch].lane,
            );
            const p2 = layout.posForCommit(
              ed.to,
              branchById[ed.to.branch].lane,
            );
            const d = rectPath(p1, p2, orientation);
            return (
              <path
                key={ed.id}
                data-testid={`${ed.style.testIdPrefix}-${ed.id}`}
                d={d}
                fill="none"
                stroke={ed.color}
                strokeWidth={theme.lineWidth}
                strokeDasharray={ed.style.dashArray}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={ed.style.opacity}
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
                data-testid={`branch-chain-${b.id}`}
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
            if (!b) return null;
            const p = layout.posForCommit(c, b.lane);
            const key = getVisualNodeId(c);
            const isSelected = key === selectedKey;
            if (c.isVirtual) {
              return (
                <VirtualStation
                  key={key}
                  commit={c}
                  pos={p}
                  color={b.color}
                  theme={theme}
                  selected={isSelected}
                  onSelect={() => onSelectCommit(c)}
                  onHover={handleHover(c)}
                  onHoverEnd={() => onHoverChange(null)}
                />
              );
            }
            return (
              <Station
                key={key}
                commit={c}
                pos={p}
                color={b.color}
                nodeStyle={nodeStyle}
                theme={theme}
                selected={isSelected}
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

interface VirtualStationProps {
  commit: CommitNode;
  pos: { x: number; y: number };
  color: string;
  theme: ThemeTokens;
  selected: boolean;
  onSelect: () => void;
  onHover: (e: MouseEvent<SVGGElement>) => void;
  onHoverEnd: () => void;
}

function VirtualStation({
  commit,
  pos,
  color,
  theme,
  selected,
  onSelect,
  onHover,
  onHoverEnd,
}: VirtualStationProps) {
  const isStart = commit.visualKind === "pr-start";
  const radius = isStart ? 4 : 5;
  const key = getVisualNodeId(commit);
  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      style={{ cursor: "pointer" }}
      data-testid={`station-${key}`}
      data-virtual={commit.visualKind ?? "virtual"}
      role="button"
      aria-label={`${commit.message}`}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onMouseLeave={onHoverEnd}
      onClick={(e) => {
        e.stopPropagation();
        onHoverEnd();
        onSelect();
      }}
    >
      {selected && (
        <circle
          r={radius + 5}
          fill="none"
          stroke={color}
          strokeOpacity={0.35}
          strokeWidth={2}
        />
      )}
      {isStart ? (
        <circle r={radius} fill={theme.canvas} stroke={color} strokeWidth={2} />
      ) : (
        <>
          <circle
            r={radius + 2}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            opacity={0.5}
          />
          <circle r={radius} fill={color} opacity={0.8} />
        </>
      )}
    </g>
  );
}
