import { describe, it, expect } from "vitest";
import { assignCommitBranches } from "./assignCommitBranches";
import type { SelectedBranch } from "./branchSelection";
import type { GitHubCommitListItem } from "@/lib/github/types";

function fakeCommit(sha: string): GitHubCommitListItem {
  return {
    sha,
    parents: [],
    commit: {
      message: sha,
      author: { name: "x", date: "2026-01-01T00:00:00Z" },
      committer: { name: "x", date: "2026-01-01T00:00:00Z" },
    },
    author: { login: "x" },
    html_url: "",
  };
}

function selected(name: string, isDefault = false): SelectedBranch {
  return { name, category: isDefault ? "main" : "feature", headSha: `${name}-head`, isDefault };
}

describe("assignCommitBranches", () => {
  it("default branch claims its own commits first", () => {
    const result = assignCommitBranches({
      selected: [selected("main", true), selected("feature")],
      commitsByBranch: {
        main: [fakeCommit("a"), fakeCommit("b")],
        feature: [fakeCommit("a"), fakeCommit("b")],
      },
    });
    expect(result.primaryByCommit).toEqual({ a: "main", b: "main" });
  });

  it("non-default branch claims unique segment until shared ancestor", () => {
    // main has a,b; feature has c,d,a — feature should claim c and d, then stop at a.
    const result = assignCommitBranches({
      selected: [selected("main", true), selected("feature")],
      commitsByBranch: {
        main: [fakeCommit("a"), fakeCommit("b")],
        feature: [fakeCommit("c"), fakeCommit("d"), fakeCommit("a")],
      },
    });
    expect(result.primaryByCommit).toEqual({
      a: "main",
      b: "main",
      c: "feature",
      d: "feature",
    });
  });

  it("processes selected branches in order so earlier branches win shared ancestors", () => {
    // featureA has [x, y], featureB has [z, x]. featureA goes first -> claims x,y.
    // featureB walks z (claim), then hits x already assigned -> stop.
    const result = assignCommitBranches({
      selected: [selected("featureA"), selected("featureB")],
      commitsByBranch: {
        featureA: [fakeCommit("x"), fakeCommit("y")],
        featureB: [fakeCommit("z"), fakeCommit("x")],
      },
    });
    expect(result.primaryByCommit).toEqual({
      x: "featureA",
      y: "featureA",
      z: "featureB",
    });
  });

  it("restricts default branch to defaultBranchOnlyClaims when provided", () => {
    // main sees [a, b, c, d]. Trunk set is only {a, c}. main should only claim those.
    const result = assignCommitBranches({
      selected: [selected("main", true)],
      commitsByBranch: {
        main: [fakeCommit("a"), fakeCommit("b"), fakeCommit("c"), fakeCommit("d")],
      },
      defaultBranchOnlyClaims: new Set(["a", "c"]),
    });
    expect(result.primaryByCommit).toEqual({ a: "main", c: "main" });
  });

  it("lets non-default branches claim commits the restricted default did not take", () => {
    // main sees [a, b], trunk = {a}. feature sees [b]. feature should claim b.
    const result = assignCommitBranches({
      selected: [selected("main", true), selected("feature")],
      commitsByBranch: {
        main: [fakeCommit("a"), fakeCommit("b")],
        feature: [fakeCommit("b")],
      },
      defaultBranchOnlyClaims: new Set(["a"]),
    });
    expect(result.primaryByCommit).toEqual({ a: "main", b: "feature" });
  });
});
