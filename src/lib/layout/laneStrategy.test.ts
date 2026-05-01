import { describe, it, expect } from "vitest";
import { stackedLaneStrategy } from "./laneStrategy";
import type { BranchLine } from "@/types/gitmetro";

describe("stackedLaneStrategy", () => {
  it("preserves the lane already assigned to each branch", () => {
    const branches: BranchLine[] = [
      { id: "a", name: "a", category: "main", lane: 0, color: "#fff" },
      { id: "b", name: "b", category: "feature", lane: -2, color: "#ddd" },
    ];
    const out = stackedLaneStrategy(branches);
    expect(out).toEqual({ a: 0, b: -2 });
  });

  it("includes every branch id", () => {
    const branches: BranchLine[] = [
      { id: "a", name: "a", category: "main", lane: 0, color: "#fff" },
      { id: "b", name: "b", category: "feature", lane: -2, color: "#ddd" },
      { id: "c", name: "c", category: "release", lane: -5, color: "#aaa" },
    ];
    const out = stackedLaneStrategy(branches);
    expect(Object.keys(out).sort()).toEqual(["a", "b", "c"]);
  });

  it("returns an empty record for an empty branch list", () => {
    expect(stackedLaneStrategy([])).toEqual({});
  });
});
