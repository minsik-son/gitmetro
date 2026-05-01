import { describe, it, expect } from "vitest";
import { normalizeGitHubGraph } from "./normalizeGitHubGraph";
import type {
  GitHubBranchListItem,
  GitHubCommitListItem,
  GitHubRepo,
  GitHubTagListItem,
} from "@/lib/github/types";

function repo(): GitHubRepo {
  return {
    owner: { login: "lumen-labs" },
    name: "lumen-pay",
    full_name: "lumen-labs/lumen-pay",
    description: "Mock repo",
    default_branch: "main",
    stargazers_count: 100,
    forks_count: 10,
    pushed_at: "2026-04-10T12:00:00Z",
    updated_at: "2026-04-10T12:00:00Z",
    private: false,
    html_url: "https://github.com/lumen-labs/lumen-pay",
  };
}

function commit(
  sha: string,
  date: string,
  parents: string[] = [],
): GitHubCommitListItem {
  return {
    sha,
    parents: parents.map((p) => ({ sha: p })),
    commit: {
      message: `feat: ${sha}`,
      author: { name: "alice", date },
      committer: { name: "alice", date },
    },
    author: { login: "alice", avatar_url: "" },
    html_url: "",
  };
}

function branchList(): GitHubBranchListItem[] {
  return [
    { name: "main", commit: { sha: "m3" } },
    { name: "feature/auth", commit: { sha: "f2" } },
    { name: "hotfix/login", commit: { sha: "h1" } },
    { name: "release/2.0", commit: { sha: "r1" } },
    { name: "develop", commit: { sha: "d1" } },
    { name: "chore/cleanup", commit: { sha: "x1" } },
  ];
}

describe("normalizeGitHubGraph (small synthetic fixture)", () => {
  const r = repo();
  const branches = branchList();
  // newest-first per GitHub convention
  const commitsByBranch: Record<string, GitHubCommitListItem[]> = {
    main: [
      commit("m3", "2026-04-10T12:00:00Z", ["m2"]),
      commit("m2", "2026-04-05T09:00:00Z", ["m1"]),
      commit("m1", "2026-04-01T09:00:00Z", []),
    ],
    "feature/auth": [
      commit("f2", "2026-04-08T10:00:00Z", ["f1"]),
      commit("f1", "2026-04-07T10:00:00Z", ["m1"]),
      commit("m1", "2026-04-01T09:00:00Z", []),
    ],
    "hotfix/login": [
      commit("h1", "2026-04-09T15:00:00Z", ["m2"]),
      commit("m2", "2026-04-05T09:00:00Z", ["m1"]),
      commit("m1", "2026-04-01T09:00:00Z", []),
    ],
    "release/2.0": [
      commit("r1", "2026-04-09T18:00:00Z", ["m2"]),
      commit("m2", "2026-04-05T09:00:00Z", ["m1"]),
      commit("m1", "2026-04-01T09:00:00Z", []),
    ],
    develop: [
      commit("d1", "2026-04-08T11:00:00Z", ["m2"]),
      commit("m2", "2026-04-05T09:00:00Z", ["m1"]),
      commit("m1", "2026-04-01T09:00:00Z", []),
    ],
    "chore/cleanup": [
      commit("x1", "2026-04-07T11:00:00Z", ["m1"]),
      commit("m1", "2026-04-01T09:00:00Z", []),
    ],
  };
  const tags: GitHubTagListItem[] = [
    { name: "v2.0.0-rc.1", commit: { sha: "r1" } },
    { name: "v1.5.0", commit: { sha: "m2" } },
  ];

  const result = normalizeGitHubGraph({
    repo: r,
    branches,
    commitsByBranch,
    tags,
    options: { maxBranches: 6, branchCommitLimit: 50, commitLimit: 100 },
  });

  it("returns a GitMetroGraph with repo summary", () => {
    expect(result.graph.repo.fullName).toBe("lumen-labs/lumen-pay");
    expect(result.graph.repo.defaultBranch).toBe("main");
  });

  it("places the default branch at lane 0", () => {
    const main = result.graph.branches.find((b) => b.id === "main");
    expect(main?.lane).toBe(0);
    expect(main?.isDefault).toBe(true);
  });

  it("stacks remaining branches at -1, -2, …", () => {
    const lanes = result.graph.branches.map((b) => b.lane);
    expect(lanes[0]).toBe(0);
    for (let i = 1; i < lanes.length; i++) {
      expect(lanes[i]).toBe(-i);
    }
  });

  it("classifies branches by name", () => {
    const cat = (id: string) =>
      result.graph.branches.find((b) => b.id === id)?.category;
    expect(cat("main")).toBe("main");
    expect(cat("develop")).toBe("develop");
    expect(cat("feature/auth")).toBe("feature");
    expect(cat("hotfix/login")).toBe("hotfix");
    expect(cat("release/2.0")).toBe("release");
    expect(cat("chore/cleanup")).toBe("other");
  });

  it("dedupes commits across branches", () => {
    const m1Count = result.graph.commits.filter((c) => c.sha === "m1").length;
    expect(m1Count).toBe(1);
  });

  it("orders commits by date ascending (t)", () => {
    for (let i = 1; i < result.graph.commits.length; i++) {
      expect(result.graph.commits[i].t).toBe(i);
    }
    const dates = result.graph.commits.map((c) => c.date);
    const sortedDates = [...dates].sort();
    expect(dates).toEqual(sortedDates);
  });

  it("marks branch heads with isHead", () => {
    const heads = result.graph.commits.filter((c) => c.isHead).map((c) => c.sha);
    expect(heads).toContain("m3");
    expect(heads).toContain("f2");
    expect(heads).toContain("h1");
    expect(heads).toContain("r1");
    expect(heads).toContain("d1");
    expect(heads).toContain("x1");
  });

  it("marks tagged commits with isTag and tag value", () => {
    const tagged = result.graph.commits.find((c) => c.sha === "r1");
    expect(tagged?.isTag).toBe(true);
    expect(tagged?.tag).toBe("v2.0.0-rc.1");
  });

  it("does not mark non-merge commits as merges", () => {
    expect(result.graph.commits.find((c) => c.sha === "f1")?.isMerge).toBe(false);
  });

  it("marks merge commits when raw parents.length > 1", () => {
    const repo2 = repo();
    const merge = commit("M", "2026-04-11T12:00:00Z", ["m3", "f2"]);
    const out = normalizeGitHubGraph({
      repo: repo2,
      branches: [
        { name: "main", commit: { sha: "M" } },
        { name: "feature/auth", commit: { sha: "f2" } },
      ],
      commitsByBranch: {
        main: [merge, commit("m3", "2026-04-10T12:00:00Z", [])],
        "feature/auth": [commit("f2", "2026-04-08T10:00:00Z", [])],
      },
      tags: [],
    });
    const m = out.graph.commits.find((c) => c.sha === "M");
    expect(m?.isMerge).toBe(true);
  });

  it("does not crash when a parent sha is unknown", () => {
    const out = normalizeGitHubGraph({
      repo: repo(),
      branches: [{ name: "main", commit: { sha: "alone" } }],
      commitsByBranch: {
        main: [commit("alone", "2026-01-01T00:00:00Z", ["nonexistent"])],
      },
      tags: [],
    });
    const c = out.graph.commits.find((cn) => cn.sha === "alone");
    expect(c?.parents).toEqual(["nonexistent"]);
  });

  it("respects maxBranches and reports truncation", () => {
    const out = normalizeGitHubGraph({
      repo: repo(),
      branches: branchList(),
      commitsByBranch,
      tags: [],
      options: { maxBranches: 3, branchCommitLimit: 50, commitLimit: 100 },
    });
    expect(out.graph.branches).toHaveLength(3);
    expect(out.meta.truncated).toBe(true);
    expect(out.meta.warnings.some((w) => /branches/.test(w))).toBe(true);
  });

  it("populates branchesTotal from the raw branch list count", () => {
    expect(result.graph.repo.branchesTotal).toBe(branches.length);
  });
});
