import { describe, it, expect } from "vitest";
import {
  buildMetroRouteLayout,
  fitBoundsToViewport,
  ROUTE_LANE_GAP,
  MAX_COMPACT_PR_LANES,
} from "./buildMetroRouteLayout";
import type {
  BranchLine,
  CommitNode,
  GitMetroGraph,
  GraphEdge,
} from "@/types/gitmetro";

function defaultBranch(): BranchLine {
  return {
    id: "main",
    name: "main",
    category: "main",
    color: "#fff",
    lane: 0,
    isDefault: true,
    isActive: true,
    source: "ref",
  };
}

function refBranch(id: string, lane: number, name?: string): BranchLine {
  return {
    id,
    name: name ?? id,
    category: "feature",
    color: "#0ff",
    lane,
    isActive: true,
    source: "ref",
  };
}

function prBranch(
  number: number,
  lane: number,
  category: BranchLine["category"] = "other",
): BranchLine {
  return {
    id: `pr/${number}`,
    name: `feature/${number}`,
    category,
    color: "#0f0",
    lane,
    isActive: true,
    isHistorical: true,
    source: "pull-request",
    pullNumber: number,
  };
}

function commit(
  sha: string,
  branch: string,
  t: number,
  overrides: Partial<CommitNode> = {},
): CommitNode {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    branch,
    t,
    parents: [],
    message: `msg ${sha}`,
    author: "x",
    date: "",
    isMerge: false,
    ...overrides,
  };
}

function virtualStart(pullNumber: number, t: number): CommitNode {
  return commit(`virtual/pr/${pullNumber}/start`, `pr/${pullNumber}`, t, {
    nodeId: `virtual/pr/${pullNumber}/start`,
    isVirtual: true,
    visualKind: "pr-start",
    displayT: t,
  });
}

function virtualEnd(pullNumber: number, t: number): CommitNode {
  return commit(`virtual/pr/${pullNumber}/end`, `pr/${pullNumber}`, t, {
    nodeId: `virtual/pr/${pullNumber}/end`,
    isVirtual: true,
    visualKind: "pr-end",
    isMerge: true,
    displayT: t,
  });
}

function prCommit(
  pullNumber: number,
  sha: string,
  t: number,
): CommitNode {
  return commit(sha, `pr/${pullNumber}`, t, {
    nodeId: `pr/${pullNumber}/commit/${sha}`,
    visualKind: "commit",
    displayT: t,
  });
}

function visibleAll(graph: GitMetroGraph): Set<string> {
  return new Set(graph.branches.map((b) => b.id));
}

describe("buildMetroRouteLayout — trunk and ref branches", () => {
  it("builds a trunk path for the default branch", () => {
    const graph: GitMetroGraph = {
      repo: { owner: "o", name: "r", fullName: "o/r", defaultBranch: "main" },
      branches: [defaultBranch()],
      commits: [
        commit("a", "main", 0),
        commit("b", "main", 4),
      ],
    };
    const layout = buildMetroRouteLayout(graph, {
      orientation: "horizontal",
      visibleBranches: visibleAll(graph),
    });
    const trunk = layout.paths.find((p) => p.kind === "trunk");
    expect(trunk).toBeDefined();
    expect(trunk!.segmentKind).toBe("trunk");
    expect(layout.visualLaneByBranchId["main"]).toBe(0);
  });

  it("places non-default ref branches on lanes 1..N", () => {
    const graph: GitMetroGraph = {
      repo: { owner: "o", name: "r", fullName: "o/r", defaultBranch: "main" },
      branches: [
        defaultBranch(),
        refBranch("develop", -1),
        refBranch("featureA", -2),
      ],
      commits: [
        commit("m1", "main", 0),
        commit("m2", "main", 5),
        commit("d1", "develop", 1),
        commit("d2", "develop", 4),
        commit("f1", "featureA", 2),
        commit("f2", "featureA", 3),
      ],
    };
    const layout = buildMetroRouteLayout(graph, {
      orientation: "horizontal",
      visibleBranches: visibleAll(graph),
    });
    expect(layout.visualLaneByBranchId["main"]).toBe(0);
    const lanes = [
      layout.visualLaneByBranchId["develop"],
      layout.visualLaneByBranchId["featureA"],
    ];
    expect(lanes).toContain(1);
    expect(lanes).toContain(2);
  });
});

function makePrEdges(pullNumber: number, anchorFromSha: string, anchorToSha: string): GraphEdge[] {
  return [
    {
      id: `pr-off/${pullNumber}`,
      from: anchorFromSha,
      to: `virtual/pr/${pullNumber}/start`,
      type: "pr-branch-off",
      branchId: `pr/${pullNumber}`,
    },
    {
      id: `pr-back/${pullNumber}`,
      from: `virtual/pr/${pullNumber}/end`,
      to: anchorToSha,
      type: "pr-merge-back",
      branchId: `pr/${pullNumber}`,
    },
  ];
}

describe("buildMetroRouteLayout — PR routes", () => {
  function prFixture(): GitMetroGraph {
    return {
      repo: { owner: "o", name: "r", fullName: "o/r", defaultBranch: "main" },
      branches: [defaultBranch(), prBranch(7, -1)],
      commits: [
        commit("M1", "main", 0),
        commit("M2", "main", 4),
        virtualStart(7, 0.35),
        prCommit(7, "p1", 2),
        virtualEnd(7, 3.65),
      ],
      edges: makePrEdges(7, "M1", "M2"),
    };
  }

  it("emits branch-off, branch, and merge-back segments for a PR route", () => {
    const graph = prFixture();
    const layout = buildMetroRouteLayout(graph, {
      orientation: "horizontal",
      visibleBranches: visibleAll(graph),
    });
    const kinds = layout.paths
      .filter((p) => p.branchId === "pr/7")
      .map((p) => p.segmentKind);
    expect(kinds).toContain("branch-off");
    expect(kinds).toContain("branch");
    expect(kinds).toContain("merge-back");
  });

  it("places PR stations on the branch lane y, not on trunk y", () => {
    const graph = prFixture();
    const layout = buildMetroRouteLayout(graph, {
      orientation: "horizontal",
      visibleBranches: visibleAll(graph),
    });
    const trunkStation = layout.byKey["M1"];
    const prCommitStation = layout.byKey["pr/7/commit/p1"];
    expect(trunkStation).toBeDefined();
    expect(prCommitStation).toBeDefined();
    expect(prCommitStation!.y).toBeGreaterThan(trunkStation!.y);
    expect(prCommitStation!.y - trunkStation!.y).toBe(ROUTE_LANE_GAP);
  });

  it("renders single-commit PR with start/commit/end on the branch lane", () => {
    const graph: GitMetroGraph = {
      repo: { owner: "o", name: "r", fullName: "o/r", defaultBranch: "main" },
      branches: [defaultBranch(), prBranch(11, -1)],
      commits: [
        commit("M1", "main", 0),
        commit("M2", "main", 3),
        virtualStart(11, 0.35),
        prCommit(11, "only", 1.5),
        virtualEnd(11, 2.65),
      ],
      edges: makePrEdges(11, "M1", "M2"),
    };
    const layout = buildMetroRouteLayout(graph, {
      orientation: "horizontal",
      visibleBranches: visibleAll(graph),
    });
    const stations = layout.stations.filter((s) => s.branchId === "pr/11");
    expect(stations).toHaveLength(3);
    const ys = new Set(stations.map((s) => s.y));
    expect(ys.size).toBe(1);
    const branchSegment = layout.paths.find(
      (p) => p.branchId === "pr/11" && p.segmentKind === "branch",
    );
    expect(branchSegment).toBeDefined();
  });

  it("includes the merge-back target station in mergeBackTargetKeys", () => {
    const graph = prFixture();
    const layout = buildMetroRouteLayout(graph, {
      orientation: "horizontal",
      visibleBranches: visibleAll(graph),
    });
    expect(layout.mergeBackTargetKeys.has("M2")).toBe(true);
    expect(layout.byKey["M2"].isMergeBackTarget).toBe(true);
  });

  it("packs non-overlapping PR routes into the same compact lane", () => {
    const branches: BranchLine[] = [defaultBranch()];
    const commits: CommitNode[] = [
      commit("M0", "main", 0),
      commit("M3", "main", 3),
      commit("M6", "main", 6),
      commit("M10", "main", 10),
    ];
    const edges: GraphEdge[] = [];
    // PR1 anchored to M0..M3, PR2 anchored to M6..M10 — disjoint intervals.
    branches.push(prBranch(1, -1));
    commits.push(virtualStart(1, 0.5), prCommit(1, "a", 1.5), virtualEnd(1, 2.5));
    edges.push(...makePrEdges(1, "M0", "M3"));
    branches.push(prBranch(2, -2));
    commits.push(virtualStart(2, 6.5), prCommit(2, "b", 7.5), virtualEnd(2, 9.5));
    edges.push(...makePrEdges(2, "M6", "M10"));
    const graph: GitMetroGraph = {
      repo: { owner: "o", name: "r", fullName: "o/r", defaultBranch: "main" },
      branches,
      commits,
      edges,
    };
    const layout = buildMetroRouteLayout(graph, {
      orientation: "horizontal",
      visibleBranches: visibleAll(graph),
    });
    expect(layout.visualLaneByBranchId["pr/1"]).toBe(
      layout.visualLaneByBranchId["pr/2"],
    );
  });

  it("does not push PR lanes far below ref lanes when refs are present", () => {
    const branches: BranchLine[] = [
      defaultBranch(),
      refBranch("develop", -1),
      prBranch(99, -50, "other"),
    ];
    const commits: CommitNode[] = [
      commit("M1", "main", 0),
      commit("M9", "main", 9),
      commit("d1", "develop", 1),
      commit("d2", "develop", 8),
      virtualStart(99, 1.5),
      prCommit(99, "p", 4),
      virtualEnd(99, 6.5),
    ];
    const edges = makePrEdges(99, "M1", "M9");
    const graph: GitMetroGraph = {
      repo: { owner: "o", name: "r", fullName: "o/r", defaultBranch: "main" },
      branches,
      commits,
      edges,
    };
    const layout = buildMetroRouteLayout(graph, {
      orientation: "horizontal",
      visibleBranches: visibleAll(graph),
    });
    expect(layout.visualLaneByBranchId["pr/99"]).toBeLessThan(5);
  });

  it("excludes hidden branches from paths and stations", () => {
    const graph = prFixture();
    const visible = new Set(["main"]);
    const layout = buildMetroRouteLayout(graph, {
      orientation: "horizontal",
      visibleBranches: visible,
    });
    expect(
      layout.paths.find((p) => p.branchId === "pr/7"),
    ).toBeUndefined();
    expect(
      layout.stations.find((s) => s.branchId === "pr/7"),
    ).toBeUndefined();
  });

  it("focusBounds includes the PR route", () => {
    const graph = prFixture();
    const layout = buildMetroRouteLayout(graph, {
      orientation: "horizontal",
      visibleBranches: visibleAll(graph),
    });
    const prStation = layout.byKey["pr/7/commit/p1"];
    expect(layout.focusBounds.maxY).toBeGreaterThanOrEqual(prStation.y);
    expect(layout.focusBounds.minX).toBeLessThanOrEqual(prStation.x);
  });

  it("supports vertical orientation by swapping axes", () => {
    const graph = prFixture();
    const layout = buildMetroRouteLayout(graph, {
      orientation: "vertical",
      visibleBranches: visibleAll(graph),
    });
    const trunkStation = layout.byKey["M1"];
    const prStation = layout.byKey["pr/7/commit/p1"];
    expect(prStation.x).toBeGreaterThan(trunkStation.x);
  });
});

describe("MAX_COMPACT_PR_LANES boundary", () => {
  it("does not exceed MAX_COMPACT_PR_LANES even with many overlapping PRs", () => {
    const branches: BranchLine[] = [defaultBranch()];
    const commits: CommitNode[] = [
      commit("M0", "main", 0),
      commit("M20", "main", 20),
    ];
    const edges: GraphEdge[] = [];
    // Many PRs overlapping at t=2..6 — must reuse lanes after MAX_COMPACT_PR_LANES.
    for (let i = 1; i <= MAX_COMPACT_PR_LANES + 4; i++) {
      branches.push(prBranch(i, -i));
      commits.push(
        virtualStart(i, 1.5),
        prCommit(i, `c${i}`, 4),
        virtualEnd(i, 6.5),
      );
      edges.push(...makePrEdges(i, "M0", "M20"));
    }
    const graph: GitMetroGraph = {
      repo: { owner: "o", name: "r", fullName: "o/r", defaultBranch: "main" },
      branches,
      commits,
      edges,
    };
    const layout = buildMetroRouteLayout(graph, {
      orientation: "horizontal",
      visibleBranches: visibleAll(graph),
    });
    const lanes = Object.entries(layout.visualLaneByBranchId)
      .filter(([id]) => id.startsWith("pr/"))
      .map(([, lane]) => lane);
    const maxLane = Math.max(...lanes);
    expect(maxLane).toBeLessThanOrEqual(MAX_COMPACT_PR_LANES);
  });
});

describe("fitBoundsToViewport", () => {
  it("scales bounds into the viewport with padding", () => {
    const fit = fitBoundsToViewport({
      bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 500 },
      viewportWidth: 800,
      viewportHeight: 600,
      padding: 40,
      minZoom: 0.25,
      maxZoom: 2,
    });
    expect(fit.zoom).toBeGreaterThan(0.25);
    expect(fit.zoom).toBeLessThanOrEqual(2);
  });

  it("clamps zoom within [minZoom, maxZoom]", () => {
    const fit = fitBoundsToViewport({
      bounds: { minX: 0, minY: 0, maxX: 100000, maxY: 100000 },
      viewportWidth: 800,
      viewportHeight: 600,
      padding: 40,
      minZoom: 0.25,
      maxZoom: 2,
    });
    expect(fit.zoom).toBe(0.25);
  });
});
