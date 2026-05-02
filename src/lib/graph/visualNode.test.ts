import { describe, it, expect } from "vitest";
import {
  buildVisualNodeIndex,
  getVisualNodeId,
  makePrCommitNodeId,
  makePrEndNodeId,
  makePrStartNodeId,
} from "./visualNode";
import type { CommitNode } from "@/types/gitmetro";

function commit(overrides: Partial<CommitNode> & { sha: string }): CommitNode {
  const base: CommitNode = {
    sha: overrides.sha,
    shortSha: overrides.shortSha ?? overrides.sha.slice(0, 7),
    branch: overrides.branch ?? "main",
    t: overrides.t ?? 0,
    parents: overrides.parents ?? [],
    message: overrides.message ?? "msg",
    author: overrides.author ?? "x",
    date: overrides.date ?? "",
    isMerge: overrides.isMerge ?? false,
  };
  return { ...base, ...overrides };
}

describe("getVisualNodeId", () => {
  it("uses nodeId when present", () => {
    expect(getVisualNodeId(commit({ sha: "a", nodeId: "virtual/x" }))).toBe(
      "virtual/x",
    );
  });

  it("falls back to sha when nodeId is absent", () => {
    expect(getVisualNodeId(commit({ sha: "abc" }))).toBe("abc");
  });
});

describe("buildVisualNodeIndex", () => {
  it("indexes both virtual nodeId and real sha", () => {
    const real = commit({ sha: "main-1" });
    const virtual = commit({
      sha: "abc",
      nodeId: "pr/7/commit/abc",
    });
    const idx = buildVisualNodeIndex([real, virtual]);
    expect(idx["main-1"]).toBe(real);
    expect(idx["pr/7/commit/abc"]).toBe(virtual);
    // The real sha "abc" still resolves (first writer wins, virtual is first by sha here).
    expect(idx["abc"]).toBe(virtual);
  });

  it("does not overwrite an earlier entry when nodeId-less sha is reused", () => {
    const a = commit({ sha: "abc" });
    const b = commit({ sha: "abc", nodeId: "pr/1/commit/abc" });
    const idx = buildVisualNodeIndex([a, b]);
    // First commit wins for both keys.
    expect(idx["abc"]).toBe(a);
    expect(idx["pr/1/commit/abc"]).toBe(b);
  });
});

describe("PR node id helpers", () => {
  it("are deterministic", () => {
    expect(makePrStartNodeId(42)).toBe("virtual/pr/42/start");
    expect(makePrEndNodeId(42)).toBe("virtual/pr/42/end");
    expect(makePrCommitNodeId(42, "sha-x")).toBe("pr/42/commit/sha-x");
  });
});
