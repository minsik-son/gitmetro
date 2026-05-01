import { describe, it, expect } from "vitest";
import {
  extractHistoricalBranches,
  parseMergeMessage,
} from "./historicalBranches";
import type { GitHubCommitListItem } from "@/lib/github/types";

function commit(
  sha: string,
  message: string,
  parents: string[] = [],
  date = "2026-01-01T00:00:00Z",
): GitHubCommitListItem {
  return {
    sha,
    parents: parents.map((p) => ({ sha: p })),
    commit: {
      message,
      author: { name: "x", date },
      committer: { name: "x", date },
    },
    author: { login: "x" },
    html_url: "",
  };
}

function pool(...commits: GitHubCommitListItem[]): Record<string, GitHubCommitListItem> {
  const out: Record<string, GitHubCommitListItem> = {};
  commits.forEach((c) => {
    out[c.sha] = c;
  });
  return out;
}

describe("parseMergeMessage", () => {
  it("parses GitHub PR merge message", () => {
    expect(parseMergeMessage("Merge pull request #1234 from alice/feature/auth")).toEqual({
      branchName: "feature/auth",
      pullNumber: 1234,
    });
  });

  it("parses git CLI 'Merge branch' message", () => {
    expect(parseMergeMessage("Merge branch 'feature/foo' into main")).toEqual({
      branchName: "feature/foo",
      pullNumber: undefined,
    });
  });

  it("parses git CLI 'Merge branch' without target", () => {
    expect(parseMergeMessage("Merge branch 'release/2.4'")).toEqual({
      branchName: "release/2.4",
      pullNumber: undefined,
    });
  });

  it("parses remote-tracking merge and strips origin/ prefix", () => {
    expect(
      parseMergeMessage("Merge remote-tracking branch 'origin/hotfix/login' into main"),
    ).toEqual({
      branchName: "hotfix/login",
      pullNumber: undefined,
    });
  });

  it("returns nulls for unrecognized commit messages", () => {
    expect(parseMergeMessage("feat: add stuff")).toEqual({
      branchName: null,
      pullNumber: undefined,
    });
  });
});

describe("extractHistoricalBranches", () => {
  // Build a tiny history:
  //  main:   A -> B -> M(merge: B + S2)
  //  side:   S1 -> S2 (off A)
  //  trunkSet = {A, B, M}
  // Expected: 1 historical branch with chain [S2, S1], mergedIntoSha=M
  const A = commit("A", "init", [], "2026-01-01T00:00:00Z");
  const B = commit("B", "feat", ["A"], "2026-01-02T00:00:00Z");
  const M = commit(
    "M",
    "Merge pull request #42 from alice/feature/wallet",
    ["B", "S2"],
    "2026-01-04T00:00:00Z",
  );
  const S1 = commit("S1", "wallet step 1", ["A"], "2026-01-02T12:00:00Z");
  const S2 = commit("S2", "wallet step 2", ["S1"], "2026-01-03T00:00:00Z");

  it("creates a historical branch from a merge's second-parent chain", () => {
    const result = extractHistoricalBranches({
      bySha: pool(A, B, M, S1, S2),
      trunkSet: new Set(["A", "B", "M"]),
      primaryByCommit: { A: "main", B: "main", M: "main" },
      historyLimit: 10,
      historyCommitLimit: 10,
    });
    expect(result.branches).toHaveLength(1);
    expect(result.branches[0].mergedIntoSha).toBe("M");
    expect(result.branches[0].sourceSha).toBe("S2");
    expect(result.branches[0].isHistorical).toBe(true);
    expect(result.branches[0].source).toBe("merge-history");
    expect(result.branches[0].name).toBe("feature/wallet");
    expect(result.branches[0].pullNumber).toBe(42);
    expect(result.historicalAssignment).toEqual({ S2: result.branches[0].id, S1: result.branches[0].id });
  });

  it("falls back to merge/{shortSha} when message has no recognizable branch name", () => {
    const merge = commit("MMMMMMM", "Random merge", ["X", "Y"], "2026-02-01T00:00:00Z");
    const X = commit("X", "trunk");
    const Y = commit("Y", "side");
    const result = extractHistoricalBranches({
      bySha: pool(merge, X, Y),
      trunkSet: new Set(["MMMMMMM", "X"]),
      primaryByCommit: { MMMMMMM: "main", X: "main" },
      historyLimit: 10,
      historyCommitLimit: 10,
    });
    expect(result.branches[0].name).toBe("merge/MMMMMMM".slice(0, 13));
    expect(result.branches[0].name.startsWith("merge/")).toBe(true);
  });

  it("respects historyLimit cap and reports capped=true", () => {
    // Build 3 merges; cap at 2.
    const make = (n: number) => {
      const t = commit(`t${n}`, "trunk", []);
      const s = commit(`s${n}`, "side", []);
      const m = commit(
        `m${n}`,
        `Merge branch 'feat/${n}'`,
        [`t${n}`, `s${n}`],
        `2026-0${n}-01T00:00:00Z`,
      );
      return [m, t, s];
    };
    const all = [...make(1), ...make(2), ...make(3)];
    const trunkSet = new Set(["m1", "m2", "m3", "t1", "t2", "t3"]);
    const primary: Record<string, string> = {};
    trunkSet.forEach((sha) => (primary[sha] = "main"));
    const result = extractHistoricalBranches({
      bySha: pool(...all),
      trunkSet,
      primaryByCommit: primary,
      historyLimit: 2,
      historyCommitLimit: 10,
    });
    expect(result.branches).toHaveLength(2);
    expect(result.capped).toBe(true);
  });

  it("respects historyCommitLimit and sets chainCapped=true", () => {
    // Merge with a 5-deep chain. Cap chain at 2.
    const trunk = commit("T", "trunk");
    const tip = commit("S5", "side 5", ["S4"], "2026-01-05T00:00:00Z");
    const s4 = commit("S4", "side 4", ["S3"], "2026-01-04T00:00:00Z");
    const s3 = commit("S3", "side 3", ["S2"], "2026-01-03T00:00:00Z");
    const s2 = commit("S2", "side 2", ["S1"], "2026-01-02T00:00:00Z");
    const s1 = commit("S1", "side 1", []);
    const merge = commit("M2", "Merge branch 'x'", ["T", "S5"], "2026-02-01T00:00:00Z");
    const result = extractHistoricalBranches({
      bySha: pool(trunk, tip, s4, s3, s2, s1, merge),
      trunkSet: new Set(["M2", "T"]),
      primaryByCommit: { M2: "main", T: "main" },
      historyLimit: 5,
      historyCommitLimit: 2,
    });
    expect(result.branches).toHaveLength(1);
    expect(Object.keys(result.historicalAssignment)).toHaveLength(2);
    expect(result.chainCapped).toBe(true);
  });

  it("stops walking when reaching a commit already on the trunk", () => {
    // S1 leads back to A which is on trunk.
    const result = extractHistoricalBranches({
      bySha: pool(A, B, M, S1, S2),
      trunkSet: new Set(["A", "B", "M"]),
      primaryByCommit: { A: "main", B: "main", M: "main" },
      historyLimit: 10,
      historyCommitLimit: 10,
    });
    // Should contain S1 and S2 only — A is the trunk stop point.
    const ids = Object.keys(result.historicalAssignment).sort();
    expect(ids).toEqual(["S1", "S2"]);
  });

  it("creates no historical branch when the chain is empty", () => {
    // Merge whose second parent is already trunk.
    const onlyTrunk = commit(
      "M9",
      "Merge branch 'x'",
      ["T", "T2"],
      "2026-03-01T00:00:00Z",
    );
    const T = commit("T", "trunk a");
    const T2 = commit("T2", "trunk b");
    const result = extractHistoricalBranches({
      bySha: pool(onlyTrunk, T, T2),
      trunkSet: new Set(["M9", "T", "T2"]),
      primaryByCommit: { M9: "main", T: "main", T2: "main" },
      historyLimit: 10,
      historyCommitLimit: 10,
    });
    expect(result.branches).toHaveLength(0);
  });
});
