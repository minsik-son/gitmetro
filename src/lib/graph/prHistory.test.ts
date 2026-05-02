import { describe, it, expect } from "vitest";
import { buildPrHistory } from "./prHistory";
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
    merged_at: overrides.merged_at ?? "2026-04-10T00:00:00Z",
    merge_commit_sha: overrides.merge_commit_sha ?? null,
    html_url:
      overrides.html_url ?? `https://github.com/o/r/pull/${overrides.number}`,
    head: overrides.head ?? {
      ref: `feature/${overrides.number}`,
      sha: `h${overrides.number}`,
    },
    base: overrides.base ?? { ref: "main", sha: "b" },
    user: overrides.user ?? { login: "alice" },
    updated_at: overrides.updated_at ?? "2026-04-10T01:00:00Z",
    created_at: overrides.created_at ?? "2026-04-09T00:00:00Z",
  };
}

function existingCommit(
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

function existingMain(): {
  branches: BranchLine[];
  bySha: Record<string, CommitNode>;
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
  const bySha: Record<string, CommitNode> = {
    M1: existingCommit("M1", "main", 0, "2026-04-09 00:00"),
    M2: existingCommit("M2", "main", 1, "2026-04-11 00:00"),
    M3: existingCommit("M3", "main", 2, "2026-04-13 00:00"),
  };
  return { branches, bySha };
}

describe("buildPrHistory", () => {
  it("creates a synthetic PR branch with pull-request source and metadata", () => {
    const { branches, bySha } = existingMain();
    const result = buildPrHistory({
      pulls: [
        pull({
          number: 7,
          title: "Add wallet",
          merge_commit_sha: "M2",
          head: { ref: "feature/wallet", sha: "h7" },
        }),
      ],
      commitsByPull: {
        7: [
          rawCommit("p7a", "2026-04-09T01:00:00Z", ["M1"]),
          rawCommit("p7b", "2026-04-09T02:00:00Z", ["p7a"]),
        ],
      },
      existingBranches: branches,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
    });

    expect(result.branches).toHaveLength(1);
    const br = result.branches[0];
    expect(br.id).toBe("pr/7");
    expect(br.source).toBe("pull-request");
    expect(br.pullNumber).toBe(7);
    expect(br.pullTitle).toBe("Add wallet");
    expect(br.pullUrl).toBe("https://github.com/o/r/pull/7");
    expect(br.name).toBe("feature/wallet");
    expect(br.category).toBe("feature");
    expect(br.lane).toBe(-2);

    expect(result.commits).toHaveLength(2);
    expect(result.commits.map((c) => c.sha)).toEqual(["p7a", "p7b"]);
    expect(result.commits.every((c) => c.branch === "pr/7")).toBe(true);
    expect(result.commits.every((c) => c.pr === "#7")).toBe(true);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      id: "pr-edge/7",
      from: "p7b",
      to: "M2",
      type: "synthetic-pr",
      branchId: "pr/7",
    });

    expect(result.fetchedPulls).toBe(1);
    expect(result.fetchedPullCommits).toBe(2);
    expect(result.capped).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it("uses head.sha as fallback when merge_commit_sha is missing from graph", () => {
    const { branches, bySha } = existingMain();
    bySha["h9"] = existingCommit("h9", "main", 1, "2026-04-11 00:00");
    const result = buildPrHistory({
      pulls: [
        pull({
          number: 9,
          merge_commit_sha: null,
          head: { ref: "feature/x", sha: "h9" },
        }),
      ],
      commitsByPull: {
        9: [rawCommit("p9a", "2026-04-09T01:00:00Z")],
      },
      existingBranches: branches,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
    });
    expect(result.edges[0].to).toBe("h9");
  });

  it("falls back to closest default branch commit by merged_at when no shared sha", () => {
    const { branches, bySha } = existingMain();
    const result = buildPrHistory({
      pulls: [
        pull({
          number: 11,
          merged_at: "2026-04-12T00:00:00Z",
          merge_commit_sha: "missing",
          head: { ref: "feature/y", sha: "missing-too" },
        }),
      ],
      commitsByPull: {
        11: [rawCommit("p11", "2026-04-09T01:00:00Z")],
      },
      existingBranches: branches,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
    });
    // First default commit with epoch >= 2026-04-12 → M3 (2026-04-13)
    expect(result.edges[0].to).toBe("M3");
  });

  it("emits a warning and skips the edge when no target sha can be determined", () => {
    const { branches, bySha } = existingMain();
    const result = buildPrHistory({
      pulls: [
        pull({
          number: 13,
          merged_at: "2030-01-01T00:00:00Z",
          merge_commit_sha: "missing",
          head: { ref: "feature/z", sha: "missing-too" },
        }),
      ],
      commitsByPull: {
        13: [rawCommit("p13", "2030-01-01T00:00:00Z")],
      },
      existingBranches: branches,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
    });
    expect(result.edges).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes("PR #13"))).toBe(true);
    // Branch and commit are still created, just disconnected.
    expect(result.branches).toHaveLength(1);
    expect(result.commits).toHaveLength(1);
  });

  it("skips PRs that are already represented by an existing pullNumber branch", () => {
    const { branches, bySha } = existingMain();
    branches.push({
      id: "history/abcdefg/0",
      name: "feature/already",
      category: "feature",
      color: "#0ff",
      lane: -1,
      isHistorical: true,
      source: "merge-history",
      pullNumber: 21,
      isActive: true,
    });
    const result = buildPrHistory({
      pulls: [pull({ number: 21 })],
      commitsByPull: { 21: [rawCommit("x", "2026-04-09T01:00:00Z")] },
      existingBranches: branches,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
    });
    expect(result.branches).toHaveLength(0);
    expect(result.commits).toHaveLength(0);
    expect(result.fetchedPulls).toBe(0);
  });

  it("skips PRs whose every commit sha is already in the existing graph", () => {
    const { branches, bySha } = existingMain();
    const result = buildPrHistory({
      pulls: [
        pull({
          number: 30,
          merge_commit_sha: "M2",
          head: { ref: "feature/dup", sha: "h30" },
        }),
      ],
      commitsByPull: {
        30: [rawCommit("M1", "2026-04-09T01:00:00Z")],
      },
      existingBranches: branches,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 24,
      prCommitLimit: 40,
    });
    expect(result.branches).toHaveLength(0);
  });

  it("respects prCommitLimit and prHistoryLimit", () => {
    const { branches, bySha } = existingMain();
    const pulls = Array.from({ length: 5 }, (_, i) =>
      pull({
        number: i + 1,
        merge_commit_sha: "M2",
        head: { ref: `feature/p${i + 1}`, sha: `head-${i + 1}` },
      }),
    );
    const commitsByPull: Record<number, GitHubCommitListItem[]> = {};
    pulls.forEach((p) => {
      commitsByPull[p.number] = Array.from({ length: 10 }, (_, k) =>
        rawCommit(`pr${p.number}-c${k}`, `2026-04-09T01:0${k}:00Z`),
      );
    });

    const result = buildPrHistory({
      pulls,
      commitsByPull,
      existingBranches: branches,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 3,
      prCommitLimit: 4,
    });

    expect(result.branches).toHaveLength(3);
    expect(result.capped).toBe(true);
    expect(result.commits.length).toBe(3 * 4);
    expect(result.warnings.some((w) => w.includes("capped"))).toBe(true);
  });

  it("does not duplicate commits when two PRs share a sha", () => {
    const { branches, bySha } = existingMain();
    const result = buildPrHistory({
      pulls: [
        pull({ number: 1, merge_commit_sha: "M2", head: { ref: "feature/a", sha: "ha" } }),
        pull({ number: 2, merge_commit_sha: "M3", head: { ref: "feature/b", sha: "hb" } }),
      ],
      commitsByPull: {
        1: [rawCommit("shared", "2026-04-09T01:00:00Z")],
        2: [rawCommit("shared", "2026-04-09T01:00:00Z")],
      },
      existingBranches: branches,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -2,
      prHistoryLimit: 5,
      prCommitLimit: 10,
    });
    // PR 1 takes the commit; PR 2 has no new commits and is dropped.
    expect(result.commits).toHaveLength(1);
    expect(result.branches.map((b) => b.id)).toEqual(["pr/1"]);
  });

  it("assigns descending lane numbers starting from startLane", () => {
    const { branches, bySha } = existingMain();
    const result = buildPrHistory({
      pulls: [
        pull({ number: 1, merge_commit_sha: "M2", head: { ref: "f1", sha: "h1" } }),
        pull({ number: 2, merge_commit_sha: "M3", head: { ref: "f2", sha: "h2" } }),
      ],
      commitsByPull: {
        1: [rawCommit("c1", "2026-04-09T00:00:00Z")],
        2: [rawCommit("c2", "2026-04-09T00:00:00Z")],
      },
      existingBranches: branches,
      existingCommitsBySha: bySha,
      defaultBranchName: "main",
      startLane: -5,
      prHistoryLimit: 10,
      prCommitLimit: 10,
    });
    expect(result.branches.map((b) => b.lane)).toEqual([-5, -6]);
  });
});
