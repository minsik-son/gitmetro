import type { BranchLine } from "@/types/gitmetro";

/**
 * Lane strategy returns the visual lane index for each branch.
 * Initial implementation: trust the lane already assigned in the data.
 * Future strategies can override (e.g., bilateral split for vertical mode).
 */
export type LaneStrategy = (branches: BranchLine[]) => Record<string, number>;

export const stackedLaneStrategy: LaneStrategy = (branches) => {
  const out: Record<string, number> = {};
  branches.forEach((b) => {
    out[b.id] = b.lane;
  });
  return out;
};
