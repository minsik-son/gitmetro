import type { BranchLine, CommitNode, MapOrientation } from "@/types/gitmetro";
import { buildVisualNodeIndex } from "@/lib/graph/visualNode";
import { stackedLaneStrategy, type LaneStrategy } from "./laneStrategy";

export const STEP = 78;
export const LANE = 64;
export const PAD_X = 120;
export const PAD_Y = 80;
export const CORNER_R = 14;

export interface Point {
  x: number;
  y: number;
}

export interface MapLayout {
  laneByBranchId: Record<string, number>;
  pos: (t: number, lane: number) => Point;
  posForCommit: (commit: CommitNode, lane: number) => Point;
  bySha: Record<string, CommitNode>;
  byNodeId: Record<string, CommitNode>;
  width: number;
  height: number;
  tMax: number;
  minLane: number;
}

function visualT(c: CommitNode): number {
  return c.displayT ?? c.t;
}

export function buildLayout(
  branches: BranchLine[],
  commits: CommitNode[],
  orientation: MapOrientation,
  strategy: LaneStrategy = stackedLaneStrategy,
): MapLayout {
  const laneByBranchId = strategy(branches);
  const tMax =
    commits.length === 0 ? 0 : Math.max(...commits.map(visualT));
  const lanes = branches.map((b) => laneByBranchId[b.id] ?? b.lane);
  const minLane = lanes.length === 0 ? 0 : Math.min(...lanes);

  const laneCoord = (lane: number) => Math.abs(lane) * LANE;

  const pos = (t: number, lane: number): Point => {
    if (orientation === "horizontal") {
      return { x: PAD_X + t * STEP, y: PAD_Y + laneCoord(lane) };
    }
    return { x: PAD_X + laneCoord(lane), y: PAD_Y + t * STEP };
  };

  const posForCommit = (commit: CommitNode, lane: number): Point =>
    pos(visualT(commit), lane);

  const bySha: Record<string, CommitNode> = {};
  commits.forEach((c) => {
    if (!bySha[c.sha]) bySha[c.sha] = c;
  });

  const byNodeId = buildVisualNodeIndex(commits);

  const width =
    orientation === "horizontal"
      ? PAD_X + (tMax + 1.2) * STEP
      : PAD_X + (Math.abs(minLane) + 1) * LANE + 80;
  const height =
    orientation === "horizontal"
      ? PAD_Y + (Math.abs(minLane) + 1) * LANE + 80
      : PAD_Y + (tMax + 1.2) * STEP;

  return {
    laneByBranchId,
    pos,
    posForCommit,
    bySha,
    byNodeId,
    width,
    height,
    tMax,
    minLane,
  };
}

export interface RectPathOptions {
  radius?: number;
  turnAt?: number;
}

export function rectPath(
  p1: Point,
  p2: Point,
  orientation: MapOrientation,
  opts: RectPathOptions = {},
): string {
  const r = opts.radius ?? CORNER_R;
  const turnAt = opts.turnAt;

  if (orientation === "horizontal") {
    const cx = turnAt != null ? turnAt : p2.x;
    const cy = p1.y;
    const dx = Math.sign(cx - p1.x) || 1;
    const dy = Math.sign(p2.y - cy) || 1;
    const beforeCornerX = cx - dx * r;
    const afterCornerY = cy + dy * r;
    const sweep = dx > 0 ? (dy > 0 ? 1 : 0) : dy > 0 ? 0 : 1;
    let d = `M ${p1.x} ${p1.y} `;
    if (Math.abs(cx - p1.x) <= r + 0.5 && Math.abs(p2.y - cy) <= r + 0.5) {
      d += `Q ${cx} ${cy} ${p2.x} ${p2.y}`;
    } else {
      d += `L ${beforeCornerX} ${cy} `;
      d += `A ${r} ${r} 0 0 ${sweep} ${cx} ${afterCornerY} `;
      d += `L ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const cy = turnAt != null ? turnAt : p2.y;
  const cx = p1.x;
  const dy = Math.sign(cy - p1.y) || 1;
  const dx = Math.sign(p2.x - cx) || 1;
  const beforeCornerY = cy - dy * r;
  const afterCornerX = cx + dx * r;
  const sweep = dy > 0 ? (dx > 0 ? 0 : 1) : dx > 0 ? 1 : 0;
  let d = `M ${p1.x} ${p1.y} `;
  if (Math.abs(cy - p1.y) <= r + 0.5 && Math.abs(p2.x - cx) <= r + 0.5) {
    d += `Q ${cx} ${cy} ${p2.x} ${p2.y}`;
  } else {
    d += `L ${cx} ${beforeCornerY} `;
    d += `A ${r} ${r} 0 0 ${sweep} ${afterCornerX} ${cy} `;
    d += `L ${p2.x} ${p2.y}`;
  }
  return d;
}
