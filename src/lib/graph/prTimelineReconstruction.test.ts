import { describe, it, expect } from "vitest";
import { buildPrTimelineHistory } from "./prTimelineReconstruction";
import type {
  GitHubCommitListItem,
  GitHubPullRequestListItem,
} from "@/lib/github/types";
import type { BranchLine, CommitNode } from "@/types/gitmetro";

function rawCommit(
  sha: string,
  date: string,
  parents: string[] = [],
): GitHubCommitListItem {
  return {
    sha,
    parents: parents.map((p) => ({ sha: p })),
    commit: {
      message: `msg ${sha}`,
      author: { name: "alice", date },
      committer: { name: "alice", date },
    },
    author: { login: "alice" },
    html_url: "",
  };
}

function pull(
  overrides: Partial<GitHubPullRequestListItem> & { number: number },
): GitHubPullRequestListItem {
  return {
    number: overrides.number,
    title: overrides.title ?? `PR ${overrides.number}`,
    state: overrides.state ?? "closed",
    merged_at:
      "merged_at" in overrides
        ? overrides.merged_at ?? null
        : "2026-04-12T00:00:00Z",
    merge_commit_sha:
      "merge_commit_sha" in overrides
        ? overrides.merge_commit_sha ?? null
        : null,
    html_url:
      overrides.html_url ?? `https://github.com/o/r/pull/${overrides.number}`,
    head: overrides.head ?? {
      ref: `feature/${overrides.number}`,
      sha: `h${overrides.number}`,
    },
    base: overrides.base ?? { ref: "main", sha: "b" },
    user: overrides.user ?? { login: "alice" },
    updated_at: overrides.updated_at ?? "2026-04-12T00:00:00Z",
    created_at: overrides.created_at ?? "2026-04-09T00:00:00Z",
  };
}

function existingCommitNode(
  sha: string,
  branch: string,
  t: number,
  date: string,
): CommitNode {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    branch,
    t,
    parents: [],
    message: sha,
    author: "x",
    date,
    isMerge: false,
  };
}

function makeFixture(): {
  branches: BranchLine[];
  bySha: Record<string, CommitNode>;
  commits: CommitNode[];
} {
  const branches: BranchLine[] = [
    {
      id: "main",
      name: "main",
      category: "main",
      color: "#fff",
      lane: 0,
      isDefault: true,
      source: "ref",
      isActive: true,
    },
  ];
  const commits: CommitNode[] = [
    existingCommitNode("M1", "main", 0, "2026-04-08 00:00"),
    existingCommitNode("M2", "main", 1, "2026-04-11 00:00"),
    existingCommitNode("M3", "main", 2, "2026-04-13 00:00"),
  ];
  const bySha: Record<string, CommitNode> = {};
  commits.forEach((c) => {
    bySha[c.sha] = c;
  });
  return { branches, bySha, commits };
}

describe("buildPrTimelineHistory", () => {
  it("creates start, commits, and end visual nodes for a multi-commit PR", () => {
    const { branches, bySha, commits } = makeFixture();
    const result = buildPrTimelineHistory({
      pulls: [
        pull({
          number: 7,
          merge_commit_sha: "M3",
          head: { ref: "feature/wallet", sha: "h7" },
        }),
      ],
      commitsByPull: {
        7: [
          rawCommit("p7a", "2026-04-09T01:00:00Z", ["M1"]),
          rawCommit("p7b", "2026-04-09T05:00:00Z", ["p7a"]),
        ],
      },
      existingBranches: branches,
      existingCommits: commits,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
      minPrVisualSpan: 2,
    });

    expect(result.reconstructedBranches).toBe(1);
    expect(result.virtualNodes).toBe(2);
    expect(result.branchOffEdges).toBe(1);
    expect(result.mergeBackEdges).toBe(1);

    // Visual nodes: start + 2 commits + end = 4
    expect(result.commits).toHaveLength(4);

    const start = result.commits.find((c) => c.visualKind === "pr-start");
    const end = result.commits.find((c) => c.visualKind === "pr-end");
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect(start!.nodeId).toBe("virtual/pr/7/start");
    expect(end!.nodeId).toBe("virtual/pr/7/end");
    expect(start!.isVirtual).toBe(true);
    expect(end!.isVirtual).toBe(true);

    const ordered = [...result.commits].sort(
      (a, b) => (a.displayT ?? a.t) - (b.displayT ?? b.t),
    );
    expect(ordered[0].visualKind).toBe("pr-start");
    expect(ordered[ordered.length - 1].visualKind).toBe("pr-end");
  });

  it("creates a single-commit PR with start, one commit, end (chain length 3)", () => {
    const { branches, bySha, commits } = makeFixture();
    const result = buildPrTimelineHistory({
      pulls: [
        pull({
          number: 9,
          merge_commit_sha: "M2",
          head: { ref: "feature/lonely", sha: "h9" },
        }),
      ],
      commitsByPull: {
        9: [rawCommit("p9", "2026-04-09T01:00:00Z", ["M1"])],
      },
      existingBranches: branches,
      existingCommits: commits,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
      minPrVisualSpan: 2,
    });

    expect(result.commits).toHaveLength(3);
    const visualKinds = result.commits.map((c) => c.visualKind);
    expect(visualKinds).toContain("pr-start");
    expect(visualKinds).toContain("pr-end");
    expect(visualKinds.filter((k) => k === undefined || k === "commit")).toHaveLength(1);

    const start = result.commits.find((c) => c.visualKind === "pr-start")!;
    const end = result.commits.find((c) => c.visualKind === "pr-end")!;
    expect((end.displayT ?? end.t) - (start.displayT ?? start.t)).toBeGreaterThanOrEqual(2);
  });

  it("emits pr-branch-off, pr-chain, and pr-merge-back edges", () => {
    const { branches, bySha, commits } = makeFixture();
    const result = buildPrTimelineHistory({
      pulls: [
        pull({
          number: 11,
          merge_commit_sha: "M3",
          head: { ref: "feature/edges", sha: "h11" },
        }),
      ],
      commitsByPull: {
        11: [rawCommit("c11", "2026-04-09T01:00:00Z", ["M1"])],
      },
      existingBranches: branches,
      existingCommits: commits,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
      minPrVisualSpan: 2,
    });

    const types = result.edges.map((e) => e.type);
    expect(types).toContain("pr-branch-off");
    expect(types).toContain("pr-chain");
    expect(types).toContain("pr-merge-back");

    const off = result.edges.find((e) => e.type === "pr-branch-off")!;
    expect(off.to).toBe("virtual/pr/11/start");
    const back = result.edges.find((e) => e.type === "pr-merge-back")!;
    expect(back.from).toBe("virtual/pr/11/end");
    expect(back.to).toBe("M3");
  });

  it("creates visual copies for shas that already exist on default branch", () => {
    const { branches, bySha, commits } = makeFixture();
    const result = buildPrTimelineHistory({
      pulls: [
        pull({
          number: 13,
          merge_commit_sha: "M3",
          head: { ref: "feature/dup", sha: "h13" },
        }),
      ],
      commitsByPull: {
        // M2 also exists on main, but PR lane should still get a visual copy.
        13: [rawCommit("M2", "2026-04-10T01:00:00Z", ["M1"])],
      },
      existingBranches: branches,
      existingCommits: commits,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
      minPrVisualSpan: 2,
    });

    const prCommit = result.commits.find(
      (c) => c.realSha === "M2" && c.branch === "pr/13",
    );
    expect(prCommit).toBeDefined();
    expect(prCommit!.nodeId).toBe("pr/13/commit/M2");
  });

  it("falls back to closest default before created_at when first parent is missing", () => {
    const { branches, bySha, commits } = makeFixture();
    const result = buildPrTimelineHistory({
      pulls: [
        pull({
          number: 17,
          merge_commit_sha: "M3",
          created_at: "2026-04-09T00:00:00Z",
          head: { ref: "feature/x", sha: "hx" },
        }),
      ],
      commitsByPull: {
        17: [rawCommit("alone", "2026-04-09T05:00:00Z", ["MISSING"])],
      },
      existingBranches: branches,
      existingCommits: commits,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
      minPrVisualSpan: 2,
    });
    const off = result.edges.find((e) => e.type === "pr-branch-off")!;
    // M1 (2026-04-08) is the closest default <= 2026-04-09.
    expect(off.from).toBe("M1");
  });

  it("emits a warning and omits merge-back edge when no anchor can be found", () => {
    const { branches, bySha, commits } = makeFixture();
    // Force the branch-off to land on the latest default commit (M3, t=2),
    // and have no future-dated default for merge-back fallbacks to use.
    const result = buildPrTimelineHistory({
      pulls: [
        pull({
          number: 21,
          // created_at is just after M3, so branchOff resolves to M3.
          created_at: "2026-04-14T00:00:00Z",
          merged_at: "2030-01-01T00:00:00Z",
          updated_at: "2030-01-01T00:00:00Z",
          merge_commit_sha: "GHOST",
          head: { ref: "feature/ghost", sha: "GHOST2" },
        }),
      ],
      commitsByPull: {
        21: [rawCommit("g1", "2026-04-14T00:00:00Z", [])],
      },
      existingBranches: branches,
      existingCommits: commits,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
      minPrVisualSpan: 2,
    });
    expect(result.edges.some((e) => e.type === "pr-merge-back")).toBe(false);
    expect(result.warnings.some((w) => w.includes("PR #21"))).toBe(true);
    expect(result.branches).toHaveLength(1);
  });

  it("respects prHistoryLimit and prCommitLimit", () => {
    const { branches, bySha, commits } = makeFixture();
    const pulls = Array.from({ length: 4 }, (_, i) =>
      pull({
        number: i + 1,
        merge_commit_sha: "M3",
        head: { ref: `feature/p${i + 1}`, sha: `h${i + 1}` },
      }),
    );
    const commitsByPull: Record<number, GitHubCommitListItem[]> = {};
    pulls.forEach((p) => {
      commitsByPull[p.number] = Array.from({ length: 6 }, (_, k) =>
        rawCommit(`pr${p.number}-c${k}`, `2026-04-09T0${k}:00:00Z`, []),
      );
    });
    const result = buildPrTimelineHistory({
      pulls,
      commitsByPull,
      existingBranches: branches,
      existingCommits: commits,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 2,
      prCommitLimit: 3,
      minPrVisualSpan: 2,
    });
    expect(result.branches).toHaveLength(2);
    expect(result.capped).toBe(true);
    // 2 PRs * (start + 3 commits + end) = 10 visual nodes
    expect(result.commits).toHaveLength(10);
  });

  it("assigns descending lane numbers starting from startLane", () => {
    const { branches, bySha, commits } = makeFixture();
    const result = buildPrTimelineHistory({
      pulls: [
        pull({ number: 1, merge_commit_sha: "M3", head: { ref: "f1", sha: "h1" } }),
        pull({ number: 2, merge_commit_sha: "M3", head: { ref: "f2", sha: "h2" } }),
      ],
      commitsByPull: {
        1: [rawCommit("c1", "2026-04-09T01:00:00Z", [])],
        2: [rawCommit("c2", "2026-04-09T01:00:00Z", [])],
      },
      existingBranches: branches,
      existingCommits: commits,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -5,
      prHistoryLimit: 10,
      prCommitLimit: 10,
      minPrVisualSpan: 2,
    });
    expect(result.branches.map((b) => b.lane)).toEqual([-5, -6]);
  });

  it("skips PRs already represented by an existing pullNumber branch", () => {
    const { branches, bySha, commits } = makeFixture();
    branches.push({
      id: "history/abcdefg/0",
      name: "feature/already",
      category: "feature",
      color: "#0ff",
      lane: -1,
      isHistorical: true,
      source: "merge-history",
      pullNumber: 33,
      isActive: true,
    });
    const result = buildPrTimelineHistory({
      pulls: [pull({ number: 33, merge_commit_sha: "M3" })],
      commitsByPull: {
        33: [rawCommit("x", "2026-04-09T01:00:00Z", [])],
      },
      existingBranches: branches,
      existingCommits: commits,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
      minPrVisualSpan: 2,
    });
    expect(result.branches).toHaveLength(0);
    expect(result.commits).toHaveLength(0);
  });

  it("orders chain edges start -> commits -> end", () => {
    const { branches, bySha, commits } = makeFixture();
    const result = buildPrTimelineHistory({
      pulls: [
        pull({
          number: 41,
          merge_commit_sha: "M3",
          head: { ref: "feature/chain", sha: "h41" },
        }),
      ],
      commitsByPull: {
        41: [
          rawCommit("a", "2026-04-09T01:00:00Z", ["M1"]),
          rawCommit("b", "2026-04-09T03:00:00Z", ["a"]),
        ],
      },
      existingBranches: branches,
      existingCommits: commits,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
      minPrVisualSpan: 2,
    });

    const chains = result.edges.filter((e) => e.type === "pr-chain");
    expect(chains.length).toBe(3);
    expect(chains[0].from).toBe("virtual/pr/41/start");
    expect(chains[0].to).toBe("pr/41/commit/a");
    expect(chains[1].from).toBe("pr/41/commit/a");
    expect(chains[1].to).toBe("pr/41/commit/b");
    expect(chains[2].from).toBe("pr/41/commit/b");
    expect(chains[2].to).toBe("virtual/pr/41/end");
  });
});
