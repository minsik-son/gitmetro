import type {
  BranchLine,
  CommitNode,
  GitMetroGraph,
  GraphEdge,
  MapOrientation,
} from "@/types/gitmetro";
import { getVisualNodeId } from "@/lib/graph/visualNode";

export const ROUTE_STEP = 84;
export const ROUTE_LANE_GAP = 86;
export const ROUTE_PAD_X = 150;
export const ROUTE_PAD_Y = 92;
export const ROUTE_CORNER_R = 18;
export const ROUTE_LANE_GAP_T = 0.6; // minimum t-gap before re-using a lane
export const MAX_COMPACT_PR_LANES = 8;

const PR_ROUTE_COLORS = [
  "#46d369",
  "#4dd8e8",
  "#f5d84c",
  "#ff9f43",
  "#7aa7ff",
  "#d86bff",
];

export type MetroRouteKind =
  | "trunk"
  | "ref"
  | "merge-history"
  | "pull-request";

export type MetroSegmentKind =
  | "trunk"
  | "branch"
  | "branch-off"
  | "merge-back";

export interface RoutedStation {
  key: string;
  commit: CommitNode;
  branchId: string;
  x: number;
  y: number;
  visualLane: number;
  isVirtual: boolean;
  isMergeBackTarget?: boolean;
}

export interface RoutedPath {
  id: string;
  branchId: string;
  kind: MetroRouteKind;
  segmentKind: MetroSegmentKind;
  d: string;
  color: string;
  opacity: number;
  dashArray?: string;
}

export interface RoutedLaneLabel {
  branchId: string;
  name: string;
  x: number;
  y: number;
  color: string;
  source?: BranchLine["source"];
  pullNumber?: number;
}

export interface RouteBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MetroRouteLayout {
  width: number;
  height: number;
  stations: RoutedStation[];
  paths: RoutedPath[];
  laneLabels: RoutedLaneLabel[];
  byKey: Record<string, RoutedStation>;
  visualLaneByBranchId: Record<string, number>;
  routeColorByBranchId: Record<string, string>;
  branchOffStationKeys: Set<string>;
  mergeBackTargetKeys: Set<string>;
  focusBounds: RouteBounds;
  fullBounds: RouteBounds;
  orientation: MapOrientation;
}

export interface BuildMetroRouteLayoutOptions {
  orientation: MapOrientation;
  visibleBranches: Set<string>;
  preferPrFocus?: boolean;
}

interface BranchInterval {
  branchId: string;
  startT: number;
  endT: number;
  branch: BranchLine;
  branchOffEdge?: GraphEdge;
  mergeBackEdge?: GraphEdge;
}

function visualT(c: CommitNode): number {
  return c.displayT ?? c.t;
}

function laneCoord(lane: number): number {
  return lane * ROUTE_LANE_GAP;
}

function tToX(t: number): number {
  return ROUTE_PAD_X + t * ROUTE_STEP;
}

function tToY(t: number): number {
  return ROUTE_PAD_Y + t * ROUTE_STEP;
}

function laneXForVertical(lane: number): number {
  return ROUTE_PAD_X + laneCoord(lane);
}

function laneYForHorizontal(lane: number): number {
  return ROUTE_PAD_Y + laneCoord(lane);
}

interface Point {
  x: number;
  y: number;
}

function pointFor(t: number, lane: number, orientation: MapOrientation): Point {
  if (orientation === "horizontal") {
    return { x: tToX(t), y: laneYForHorizontal(lane) };
  }
  return { x: laneXForVertical(lane), y: tToY(t) };
}

function buildIndexes(graph: GitMetroGraph): {
  byNodeId: Record<string, CommitNode>;
  bySha: Record<string, CommitNode>;
} {
  const byNodeId: Record<string, CommitNode> = {};
  const bySha: Record<string, CommitNode> = {};
  graph.commits.forEach((c) => {
    const id = getVisualNodeId(c);
    if (!byNodeId[id]) byNodeId[id] = c;
    if (!bySha[c.sha]) bySha[c.sha] = c;
  });
  return { byNodeId, bySha };
}

function findBranchOffEdge(
  edges: GraphEdge[],
  branchId: string,
): GraphEdge | undefined {
  return edges.find(
    (e) => e.branchId === branchId && e.type === "pr-branch-off",
  );
}

function findMergeBackEdge(
  edges: GraphEdge[],
  branchId: string,
): GraphEdge | undefined {
  return edges.find(
    (e) => e.branchId === branchId && e.type === "pr-merge-back",
  );
}

function computeBranchInterval(
  branch: BranchLine,
  graph: GitMetroGraph,
  edges: GraphEdge[],
  byNodeId: Record<string, CommitNode>,
): BranchInterval | null {
  const ownCommits = graph.commits.filter((c) => c.branch === branch.id);
  const branchOffEdge = findBranchOffEdge(edges, branch.id);
  const mergeBackEdge = findMergeBackEdge(edges, branch.id);

  let startT: number | null = null;
  let endT: number | null = null;

  if (branchOffEdge) {
    const anchor = byNodeId[branchOffEdge.from];
    if (anchor) startT = visualT(anchor);
  }
  if (mergeBackEdge) {
    const anchor = byNodeId[mergeBackEdge.to];
    if (anchor) endT = visualT(anchor);
  }

  if (ownCommits.length > 0) {
    const ts = ownCommits.map(visualT);
    const minOwn = Math.min(...ts);
    const maxOwn = Math.max(...ts);
    if (startT == null) startT = minOwn;
    if (endT == null) endT = maxOwn;
    startT = Math.min(startT, minOwn);
    endT = Math.max(endT, maxOwn);
  }

  if (startT == null || endT == null) return null;
  if (endT < startT) endT = startT;

  return { branchId: branch.id, startT, endT, branch, branchOffEdge, mergeBackEdge };
}

function assignVisualLanes(
  graph: GitMetroGraph,
  visibleBranches: Set<string>,
  byNodeId: Record<string, CommitNode>,
  edges: GraphEdge[],
): {
  visualLaneByBranchId: Record<string, number>;
  intervalByBranchId: Record<string, BranchInterval>;
} {
  const visualLaneByBranchId: Record<string, number> = {};
  const intervalByBranchId: Record<string, BranchInterval> = {};

  const defaultBranch = graph.branches.find((b) => b.isDefault);
  if (defaultBranch && visibleBranches.has(defaultBranch.id)) {
    visualLaneByBranchId[defaultBranch.id] = 0;
    const iv = computeBranchInterval(defaultBranch, graph, edges, byNodeId);
    if (iv) intervalByBranchId[defaultBranch.id] = iv;
  }

  // Non-default visible branches: ref-style (own lane each) first, then PR-style (compact).
  const nonDefault = graph.branches.filter(
    (b) =>
      visibleBranches.has(b.id) && !b.isDefault && b.source !== "pull-request",
  );
  const prBranches = graph.branches.filter(
    (b) => visibleBranches.has(b.id) && b.source === "pull-request",
  );

  // Ref branches sorted by their data lane (most positive first, then most negative).
  const refSorted = [...nonDefault].sort((a, b) => b.lane - a.lane);
  let nextLane = 1;
  refSorted.forEach((b) => {
    const iv = computeBranchInterval(b, graph, edges, byNodeId);
    if (!iv) return;
    visualLaneByBranchId[b.id] = nextLane++;
    intervalByBranchId[b.id] = iv;
  });

  // PR branches: compact interval packing.
  const prIntervals = prBranches
    .map((b) => computeBranchInterval(b, graph, edges, byNodeId))
    .filter((iv): iv is BranchInterval => !!iv)
    .sort((a, b) => a.startT - b.startT);

  const prLaneEnds: number[] = []; // index = lane offset within PR pool
  prIntervals.forEach((iv) => {
    let placedLane: number | null = null;
    for (let i = 0; i < prLaneEnds.length; i++) {
      if (prLaneEnds[i] + ROUTE_LANE_GAP_T <= iv.startT) {
        prLaneEnds[i] = iv.endT;
        placedLane = i;
        break;
      }
    }
    if (placedLane == null) {
      if (prLaneEnds.length < MAX_COMPACT_PR_LANES) {
        prLaneEnds.push(iv.endT);
        placedLane = prLaneEnds.length - 1;
      } else {
        // Past the cap, just append to the lane that ends earliest (still re-using).
        let earliest = 0;
        for (let i = 1; i < prLaneEnds.length; i++) {
          if (prLaneEnds[i] < prLaneEnds[earliest]) earliest = i;
        }
        prLaneEnds[earliest] = iv.endT;
        placedLane = earliest;
      }
    }
    visualLaneByBranchId[iv.branchId] = nextLane + placedLane;
    intervalByBranchId[iv.branchId] = iv;
  });

  return { visualLaneByBranchId, intervalByBranchId };
}

function corneredBranchOffPath(
  anchor: Point,
  laneCoordValue: number,
  orientation: MapOrientation,
): string {
  const r = ROUTE_CORNER_R;
  if (orientation === "horizontal") {
    const yTrunk = anchor.y;
    const yBranch = laneCoordValue;
    const sign = yBranch > yTrunk ? 1 : -1;
    return [
      `M ${anchor.x} ${yTrunk}`,
      `L ${anchor.x} ${yBranch - r * sign}`,
      `Q ${anchor.x} ${yBranch} ${anchor.x + r} ${yBranch}`,
    ].join(" ");
  }
  const xTrunk = anchor.x;
  const xBranch = laneCoordValue;
  const sign = xBranch > xTrunk ? 1 : -1;
  return [
    `M ${xTrunk} ${anchor.y}`,
    `L ${xBranch - r * sign} ${anchor.y}`,
    `Q ${xBranch} ${anchor.y} ${xBranch} ${anchor.y + r}`,
  ].join(" ");
}

function corneredMergeBackPath(
  anchor: Point,
  laneCoordValue: number,
  orientation: MapOrientation,
): string {
  const r = ROUTE_CORNER_R;
  if (orientation === "horizontal") {
    const yTrunk = anchor.y;
    const yBranch = laneCoordValue;
    const sign = yBranch > yTrunk ? 1 : -1;
    return [
      `M ${anchor.x - r} ${yBranch}`,
      `Q ${anchor.x} ${yBranch} ${anchor.x} ${yBranch - r * sign}`,
      `L ${anchor.x} ${yTrunk}`,
    ].join(" ");
  }
  const xTrunk = anchor.x;
  const xBranch = laneCoordValue;
  const sign = xBranch > xTrunk ? 1 : -1;
  return [
    `M ${xBranch} ${anchor.y - r}`,
    `Q ${xBranch} ${anchor.y} ${xBranch - r * sign} ${anchor.y}`,
    `L ${xTrunk} ${anchor.y}`,
  ].join(" ");
}

function straightBranchPath(
  startX: number,
  endX: number,
  laneCoordValue: number,
  orientation: MapOrientation,
): string {
  if (orientation === "horizontal") {
    return `M ${startX} ${laneCoordValue} L ${endX} ${laneCoordValue}`;
  }
  return `M ${laneCoordValue} ${startX} L ${laneCoordValue} ${endX}`;
}

function pickRouteColor(
  branch: BranchLine,
  prIndex: number | null,
): string {
  if (branch.source === "pull-request" && prIndex != null) {
    return PR_ROUTE_COLORS[prIndex % PR_ROUTE_COLORS.length];
  }
  return branch.color;
}

function expandBounds(b: RouteBounds, p: Point) {
  if (p.x < b.minX) b.minX = p.x;
  if (p.x > b.maxX) b.maxX = p.x;
  if (p.y < b.minY) b.minY = p.y;
  if (p.y > b.maxY) b.maxY = p.y;
}

export function buildMetroRouteLayout(
  graph: GitMetroGraph,
  options: BuildMetroRouteLayoutOptions,
): MetroRouteLayout {
  const orientation = options.orientation;
  const visibleBranches = options.visibleBranches;
  const edges = graph.edges ?? [];
  const { byNodeId } = buildIndexes(graph);

  const { visualLaneByBranchId, intervalByBranchId } = assignVisualLanes(
    graph,
    visibleBranches,
    byNodeId,
    edges,
  );

  // Assign per-PR color cycle (in lane-pack order so neighbours differ).
  const prBranchIds = graph.branches
    .filter(
      (b) => visibleBranches.has(b.id) && b.source === "pull-request",
    )
    .map((b) => b.id);
  const prColorByBranchId: Record<string, number> = {};
  prBranchIds.forEach((id, idx) => {
    prColorByBranchId[id] = idx;
  });
  const routeColorByBranchId: Record<string, string> = {};
  graph.branches.forEach((b) => {
    routeColorByBranchId[b.id] = pickRouteColor(
      b,
      b.source === "pull-request" ? prColorByBranchId[b.id] ?? 0 : null,
    );
  });

  const stations: RoutedStation[] = [];
  const byKey: Record<string, RoutedStation> = {};
  const paths: RoutedPath[] = [];
  const laneLabels: RoutedLaneLabel[] = [];
  const branchOffStationKeys = new Set<string>();
  const mergeBackTargetKeys = new Set<string>();

  const fullBounds: RouteBounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  const focusBounds: RouteBounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  let focusHasContent = false;

  // Build stations for every visible branch.
  graph.branches.forEach((branch) => {
    if (!visibleBranches.has(branch.id)) return;
    const lane = visualLaneByBranchId[branch.id];
    if (lane == null) return;
    const ownCommits = graph.commits.filter((c) => c.branch === branch.id);
    ownCommits
      .slice()
      .sort((a, b) => visualT(a) - visualT(b))
      .forEach((commit) => {
        const t = visualT(commit);
        const p = pointFor(t, lane, orientation);
        const key = getVisualNodeId(commit);
        const station: RoutedStation = {
          key,
          commit,
          branchId: branch.id,
          x: p.x,
          y: p.y,
          visualLane: lane,
          isVirtual: !!commit.isVirtual,
        };
        stations.push(station);
        byKey[key] = station;
        expandBounds(fullBounds, p);
        if (branch.source === "pull-request" || branch.isDefault) {
          expandBounds(focusBounds, p);
          focusHasContent = true;
        }
      });
  });

  // Generate paths.
  const defaultBranch = graph.branches.find((b) => b.isDefault);
  const trunkLane = defaultBranch ? visualLaneByBranchId[defaultBranch.id] : null;

  graph.branches.forEach((branch) => {
    if (!visibleBranches.has(branch.id)) return;
    const lane = visualLaneByBranchId[branch.id];
    if (lane == null) return;
    const interval = intervalByBranchId[branch.id];
    if (!interval) return;
    const color = routeColorByBranchId[branch.id];

    if (branch.isDefault) {
      const start = pointFor(interval.startT, lane, orientation);
      const end = pointFor(interval.endT, lane, orientation);
      const d = orientation === "horizontal"
        ? `M ${start.x} ${start.y} L ${end.x} ${end.y}`
        : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      paths.push({
        id: `route-${branch.id}-trunk`,
        branchId: branch.id,
        kind: "trunk",
        segmentKind: "trunk",
        d,
        color,
        opacity: 0.95,
      });
      expandBounds(fullBounds, start);
      expandBounds(fullBounds, end);
      return;
    }

    if (branch.source === "pull-request" && trunkLane != null) {
      const branchOff = interval.branchOffEdge;
      const mergeBack = interval.mergeBackEdge;
      const anchorStartNode = branchOff
        ? byNodeId[branchOff.from]
        : undefined;
      const anchorEndNode = mergeBack ? byNodeId[mergeBack.to] : undefined;

      const anchorStartT = anchorStartNode
        ? visualT(anchorStartNode)
        : interval.startT - 0.35;
      const anchorEndT = anchorEndNode
        ? visualT(anchorEndNode)
        : interval.endT + 0.35;

      const trunkPoint = (t: number) => pointFor(t, trunkLane, orientation);
      const branchPoint = (t: number) => pointFor(t, lane, orientation);

      const anchorStart = trunkPoint(anchorStartT);
      const anchorEnd = trunkPoint(anchorEndT);
      const laneAxis =
        orientation === "horizontal"
          ? laneYForHorizontal(lane)
          : laneXForVertical(lane);

      paths.push({
        id: `route-${branch.id}-branch-off`,
        branchId: branch.id,
        kind: "pull-request",
        segmentKind: "branch-off",
        d: corneredBranchOffPath(anchorStart, laneAxis, orientation),
        color,
        opacity: 0.92,
      });
      // The straight branch segment runs from the post-corner to the pre-corner.
      const branchStartPt = branchPoint(anchorStartT);
      const branchEndPt = branchPoint(anchorEndT);
      const innerStart =
        orientation === "horizontal"
          ? branchStartPt.x + ROUTE_CORNER_R
          : branchStartPt.y + ROUTE_CORNER_R;
      const innerEnd =
        orientation === "horizontal"
          ? branchEndPt.x - ROUTE_CORNER_R
          : branchEndPt.y - ROUTE_CORNER_R;
      paths.push({
        id: `route-${branch.id}-branch`,
        branchId: branch.id,
        kind: "pull-request",
        segmentKind: "branch",
        d: straightBranchPath(innerStart, innerEnd, laneAxis, orientation),
        color,
        opacity: 0.95,
      });
      paths.push({
        id: `route-${branch.id}-merge-back`,
        branchId: branch.id,
        kind: "pull-request",
        segmentKind: "merge-back",
        d: corneredMergeBackPath(anchorEnd, laneAxis, orientation),
        color,
        opacity: 0.92,
      });

      expandBounds(fullBounds, anchorStart);
      expandBounds(fullBounds, anchorEnd);
      expandBounds(fullBounds, branchStartPt);
      expandBounds(fullBounds, branchEndPt);
      expandBounds(focusBounds, anchorStart);
      expandBounds(focusBounds, anchorEnd);
      expandBounds(focusBounds, branchStartPt);
      expandBounds(focusBounds, branchEndPt);
      focusHasContent = true;

      if (anchorStartNode) {
        branchOffStationKeys.add(getVisualNodeId(anchorStartNode));
      }
      if (anchorEndNode) {
        mergeBackTargetKeys.add(getVisualNodeId(anchorEndNode));
        const targetStation = byKey[getVisualNodeId(anchorEndNode)];
        if (targetStation) targetStation.isMergeBackTarget = true;
      }
      return;
    }

    // Other ref / merge-history branch — single straight lane line.
    const start = pointFor(interval.startT, lane, orientation);
    const end = pointFor(interval.endT, lane, orientation);
    paths.push({
      id: `route-${branch.id}-branch`,
      branchId: branch.id,
      kind:
        branch.source === "merge-history"
          ? "merge-history"
          : "ref",
      segmentKind: "branch",
      d:
        orientation === "horizontal"
          ? `M ${start.x} ${start.y} L ${end.x} ${end.y}`
          : `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      color,
      opacity: 0.92,
    });
    expandBounds(fullBounds, start);
    expandBounds(fullBounds, end);
  });

  // Lane labels: at the lane's left edge.
  graph.branches.forEach((branch) => {
    if (!visibleBranches.has(branch.id)) return;
    const lane = visualLaneByBranchId[branch.id];
    if (lane == null) return;
    const interval = intervalByBranchId[branch.id];
    if (!interval) return;
    const color = routeColorByBranchId[branch.id];
    if (orientation === "horizontal") {
      laneLabels.push({
        branchId: branch.id,
        name: branch.name,
        x: 18,
        y: laneYForHorizontal(lane),
        color,
        source: branch.source,
        pullNumber: branch.pullNumber,
      });
    } else {
      laneLabels.push({
        branchId: branch.id,
        name: branch.name,
        x: laneXForVertical(lane),
        y: 18,
        color,
        source: branch.source,
        pullNumber: branch.pullNumber,
      });
    }
  });

  // Finalize bounds.
  if (!Number.isFinite(fullBounds.minX)) {
    fullBounds.minX = 0;
    fullBounds.minY = 0;
    fullBounds.maxX = ROUTE_PAD_X;
    fullBounds.maxY = ROUTE_PAD_Y;
  }
  if (!focusHasContent) {
    focusBounds.minX = fullBounds.minX;
    focusBounds.minY = fullBounds.minY;
    focusBounds.maxX = fullBounds.maxX;
    focusBounds.maxY = fullBounds.maxY;
  }

  const lanesUsed = Object.values(visualLaneByBranchId);
  const maxLane = lanesUsed.length > 0 ? Math.max(...lanesUsed) : 0;

  const width =
    orientation === "horizontal"
      ? Math.max(fullBounds.maxX + ROUTE_PAD_X, ROUTE_PAD_X * 2)
      : Math.max(
          ROUTE_PAD_X + (maxLane + 1) * ROUTE_LANE_GAP + ROUTE_PAD_X,
          ROUTE_PAD_X * 2,
        );
  const height =
    orientation === "horizontal"
      ? Math.max(
          ROUTE_PAD_Y + (maxLane + 1) * ROUTE_LANE_GAP + ROUTE_PAD_Y,
          ROUTE_PAD_Y * 2,
        )
      : Math.max(fullBounds.maxY + ROUTE_PAD_Y, ROUTE_PAD_Y * 2);

  return {
    width,
    height,
    stations,
    paths,
    laneLabels,
    byKey,
    visualLaneByBranchId,
    routeColorByBranchId,
    branchOffStationKeys,
    mergeBackTargetKeys,
    focusBounds,
    fullBounds,
    orientation,
  };
}

export interface FitToViewportOptions {
  bounds: RouteBounds;
  viewportWidth: number;
  viewportHeight: number;
  padding: number;
  minZoom: number;
  maxZoom: number;
}

export function fitBoundsToViewport(opts: FitToViewportOptions): {
  zoom: number;
  pan: { x: number; y: number };
} {
  const w = Math.max(1, opts.bounds.maxX - opts.bounds.minX);
  const h = Math.max(1, opts.bounds.maxY - opts.bounds.minY);
  const availW = Math.max(1, opts.viewportWidth - opts.padding * 2);
  const availH = Math.max(1, opts.viewportHeight - opts.padding * 2);
  const zoomX = availW / w;
  const zoomY = availH / h;
  const rawZoom = Math.min(zoomX, zoomY);
  const zoom = Math.max(opts.minZoom, Math.min(opts.maxZoom, rawZoom));
  const cx = (opts.bounds.minX + opts.bounds.maxX) / 2;
  const cy = (opts.bounds.minY + opts.bounds.maxY) / 2;
  const pan = {
    x: opts.viewportWidth / 2 - cx * zoom,
    y: opts.viewportHeight / 2 - cy * zoom,
  };
  return { zoom, pan };
}
