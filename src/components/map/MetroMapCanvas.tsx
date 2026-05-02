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
  BranchLine,
  CommitNode,
  GitMetroGraph,
  GraphEdge,
  MapOrientation,
} from "@/types/gitmetro";
import {
  buildMetroRouteLayout,
  fitBoundsToViewport,
  type RoutedStation,
} from "@/lib/layout/buildMetroRouteLayout";
import { rectPath } from "@/lib/layout/buildLayout";
import { clampZoom, zoomAtPoint } from "@/lib/layout/viewportTransform";
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
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const FIT_PADDING_PX = 56;

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
};

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
  const routeLayout = useMemo(
    () =>
      buildMetroRouteLayout(data, {
        orientation,
        visibleBranches,
        preferPrFocus: true,
      }),
    [data, orientation, visibleBranches],
  );

  const branchById = useMemo(() => {
    const m: Record<string, BranchLine> = {};
    data.branches.forEach((b) => {
      m[b.id] = b;
    });
    return m;
  }, [data.branches]);

  const parentEdges = useMemo(() => {
    type ParentEdge = {
      id: string;
      from: RoutedStation;
      to: RoutedStation;
      color: string;
    };
    const e: ParentEdge[] = [];
    data.commits.forEach((c) => {
      // Visual-only nodes (PR commits, virtual start/end) are wired by route paths.
      if (c.nodeId) return;
      const childKey = getVisualNodeId(c);
      const childStation = routeLayout.byKey[childKey];
      if (!childStation) return;
      c.parents.forEach((psha) => {
        const parentStation =
          routeLayout.byKey[psha] ?? routeLayout.byKey[psha];
        if (!parentStation) return;
        if (parentStation.branchId === childStation.branchId && !c.isMerge) {
          return;
        }
        if (c.isMerge && parentStation.branchId === childStation.branchId) {
          return;
        }
        e.push({
          id: `${psha}->${c.sha}`,
          from: parentStation,
          to: childStation,
          color:
            routeLayout.routeColorByBranchId[parentStation.branchId] ??
            theme.text,
        });
      });
    });
    return e;
  }, [data.commits, routeLayout, theme.text]);

  const syntheticEdges = useMemo(() => {
    const list: GraphEdge[] = data.edges ?? [];
    return list
      .map((edge) => {
        const style = SYNTHETIC_EDGE_STYLES[edge.type];
        if (!style) return null;
        const from = routeLayout.byKey[edge.from];
        const to = routeLayout.byKey[edge.to];
        if (!from || !to) return null;
        const color = edge.branchId
          ? routeLayout.routeColorByBranchId[edge.branchId] ?? theme.text
          : edge.color ?? theme.text;
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
          from: RoutedStation;
          to: RoutedStation;
          color: string;
          branchId: string | undefined;
          style: SyntheticEdgeStyle;
        } => v !== null,
      );
  }, [data.edges, routeLayout, theme.text]);

  const drag = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const movedDuringPress = useRef(false);
  const hasUserNavigatedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

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
        hasUserNavigatedRef.current = true;
      }
      const nextPan = {
        x: drag.current.panX + dx,
        y: drag.current.panY + dy,
      };
      panRef.current = nextPan;
      setPan(nextPan);
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

  // Auto-fit on initial layout / orientation change while user has not navigated.
  useEffect(() => {
    hasUserNavigatedRef.current = false;
  }, [orientation, data]);

  useEffect(() => {
    if (hasUserNavigatedRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) return;
    const fit = fitBoundsToViewport({
      bounds: routeLayout.focusBounds,
      viewportWidth: rect.width,
      viewportHeight: rect.height,
      padding: FIT_PADDING_PX,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
    zoomRef.current = fit.zoom;
    panRef.current = fit.pan;
    setZoom(() => fit.zoom);
    setPan(fit.pan);
  }, [routeLayout, setZoom, setPan]);

  const onSvgClick = () => {
    if (movedDuringPress.current) {
      movedDuringPress.current = false;
      return;
    }
    onHoverChange(null);
    onClearSelection();
  };

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const anchor = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const delta = -e.deltaY * 0.0015;
    const oldZoom = zoomRef.current;
    const oldPan = panRef.current;
    const nextZoom = clampZoom(oldZoom + delta, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === oldZoom) return;
    const nextPan = zoomAtPoint({
      oldZoom,
      nextZoom,
      pan: oldPan,
      anchor,
    });

    hasUserNavigatedRef.current = true;
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(() => nextZoom);
    setPan(nextPan);
  };

  const showCommit = useCallback(
    (c: CommitNode) => visibleBranches.has(c.branch),
    [visibleBranches],
  );

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
      ref={containerRef}
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
          {/* Lane guide lines (subtle) for visible non-default lanes. */}
          {data.branches.map((b) => {
            if (!visibleBranches.has(b.id)) return null;
            const lane = routeLayout.visualLaneByBranchId[b.id];
            if (lane == null || lane === 0) return null;
            const start =
              orientation === "horizontal"
                ? { x: 40, y: 92 + lane * 86 }
                : { x: 150 + lane * 86, y: 40 };
            const end =
              orientation === "horizontal"
                ? { x: routeLayout.width - 40, y: start.y }
                : { x: start.x, y: routeLayout.height - 40 };
            return (
              <line
                key={`guide-${b.id}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={theme.guide}
                strokeDasharray="2 6"
                strokeWidth={1}
              />
            );
          })}

          {/* Cross-branch parent edges (real commit topology). */}
          {parentEdges.map((ed) => {
            const p1 = { x: ed.from.x, y: ed.from.y };
            const p2 = { x: ed.to.x, y: ed.to.y };
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

          {/* Trunk + branch + PR route paths. */}
          {routeLayout.paths.map((path) => (
            <path
              key={path.id}
              data-testid={`route-path-${path.branchId}-${path.segmentKind}`}
              data-segment-kind={path.segmentKind}
              data-route-kind={path.kind}
              d={path.d}
              fill="none"
              stroke={path.color}
              strokeWidth={theme.lineWidth}
              strokeDasharray={path.dashArray}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={path.opacity}
            />
          ))}

          {/* Legacy synthetic-pr edges (pre-reconstruction mode). */}
          {syntheticEdges.map((ed) => {
            if (ed.branchId && !visibleBranches.has(ed.branchId)) return null;
            const p1 = { x: ed.from.x, y: ed.from.y };
            const p2 = { x: ed.to.x, y: ed.to.y };
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

          {/* Merge-back transfer ring overlay on default branch anchor stations. */}
          {Array.from(routeLayout.mergeBackTargetKeys).map((key) => {
            const station = routeLayout.byKey[key];
            if (!station) return null;
            return (
              <circle
                key={`transfer-${key}`}
                cx={station.x}
                cy={station.y}
                r={11}
                fill="none"
                stroke={theme.guide}
                strokeWidth={1.5}
                opacity={0.75}
              />
            );
          })}

          {/* Stations + virtual nodes. */}
          {data.commits.map((c) => {
            if (!showCommit(c)) return null;
            const key = getVisualNodeId(c);
            const station = routeLayout.byKey[key];
            if (!station) return null;
            const branch = branchById[c.branch];
            if (!branch) return null;
            const color =
              routeLayout.routeColorByBranchId[c.branch] ?? branch.color;
            const isSelected = key === selectedKey;
            if (c.isVirtual) {
              return (
                <VirtualStation
                  key={key}
                  commit={c}
                  pos={{ x: station.x, y: station.y }}
                  color={color}
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
                pos={{ x: station.x, y: station.y }}
                color={color}
                nodeStyle={nodeStyle}
                theme={theme}
                selected={isSelected}
                onSelect={() => onSelectCommit(c)}
                onHover={handleHover(c)}
                onHoverEnd={() => onHoverChange(null)}
              />
            );
          })}

          {/* Lane labels at the left edge. */}
          {routeLayout.laneLabels.map((label) => (
            <g
              key={`label-${label.branchId}`}
              transform={`translate(${label.x},${label.y})`}
            >
              <rect
                x={orientation === "horizontal" ? 0 : -36}
                y={orientation === "horizontal" ? -14 : 0}
                width={Math.min(92, Math.max(56, label.name.length * 7))}
                height={22}
                rx={4}
                fill={label.color}
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
                {truncateLabel(label.name, 14)}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

function truncateLabel(name: string, max: number): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + "…";
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
          <circle r={radius} fill={color} opacity={0.85} />
        </>
      )}
    </g>
  );
}
