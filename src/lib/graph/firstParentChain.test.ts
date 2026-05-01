import { describe, it, expect } from "vitest";
import { firstParentChain } from "./firstParentChain";
import type { GitHubCommitListItem } from "@/lib/github/types";

function commit(sha: string, parents: string[] = []): GitHubCommitListItem {
  return {
    sha,
    parents: parents.map((p) => ({ sha: p })),
    commit: {
      message: sha,
      author: { name: "x", date: "2026-01-01T00:00:00Z" },
      committer: { name: "x", date: "2026-01-01T00:00:00Z" },
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

describe("firstParentChain", () => {
  it("returns an empty set when headSha is missing", () => {
    expect(firstParentChain({}, undefined)).toEqual(new Set());
  });

  it("returns an empty set when headSha is not in the pool", () => {
    expect(firstParentChain(pool(commit("a")), "z")).toEqual(new Set());
  });

  it("walks linear history through every commit", () => {
    const result = firstParentChain(
      pool(commit("c", ["b"]), commit("b", ["a"]), commit("a")),
      "c",
    );
    expect(Array.from(result).sort()).toEqual(["a", "b", "c"]);
  });

  it("only follows parents[0] for merge commits", () => {
    // m has parents [t, side]. Only t should be on the trunk.
    const result = firstParentChain(
      pool(
        commit("m", ["t", "side"]),
        commit("t", ["a"]),
        commit("a"),
        commit("side", ["a"]),
      ),
      "m",
    );
    expect(Array.from(result).sort()).toEqual(["a", "m", "t"]);
    expect(result.has("side")).toBe(false);
  });

  it("stops when the next first parent is missing from the pool", () => {
    const result = firstParentChain(
      pool(commit("c", ["b"]), commit("b", ["missing"])),
      "c",
    );
    expect(Array.from(result).sort()).toEqual(["b", "c"]);
  });

  it("returns empty set when given empty headSha string", () => {
    expect(firstParentChain(pool(commit("a")), "")).toEqual(new Set());
  });
});
