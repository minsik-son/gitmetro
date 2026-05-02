import { describe, it, expect } from "vitest";
import { buildDefaultVisibleBranches } from "./defaultVisibleBranches";
import type { BranchLine, GitMetroGraph } from "@/types/gitmetro";

function branch(overrides: Partial<BranchLine> & { id: string }): BranchLine {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    category: overrides.category ?? "feature",
    color: overrides.color ?? "#fff",
    lane: overrides.lane ?? 0,
    isDefault: overrides.isDefault,
    isActive: overrides.isActive ?? true,
    isHistorical: overrides.isHistorical,
    source: overrides.source ?? "ref",
    pullNumber: overrides.pullNumber,
  };
}

function graph(branches: BranchLine[]): GitMetroGraph {
  return {
    repo: { owner: "o", name: "r", fullName: "o/r", defaultBranch: "main" },
    branches,
    commits: [],
  };
}

describe("buildDefaultVisibleBranches", () => {
  it("returns all branches when there are no PR branches", () => {
    const g = graph([
      branch({ id: "main", category: "main", isDefault: true }),
      branch({ id: "develop", category: "develop" }),
      branch({ id: "0.10-stable", category: "other" }),
    ]);
    const result = buildDefaultVisibleBranches(g);
    expect(result.has("main")).toBe(true);
    expect(result.has("develop")).toBe(true);
    expect(result.has("0.10-stable")).toBe(true);
  });

  it("hides 'other' ref branches when PR branches exist", () => {
    const g = graph([
      branch({ id: "main", category: "main", isDefault: true }),
      branch({ id: "develop", category: "develop" }),
      branch({ id: "0.10-stable", category: "other" }),
      branch({ id: "0.11-stable", category: "other" }),
      branch({
        id: "pr/1",
        category: "feature",
        source: "pull-request",
        pullNumber: 1,
      }),
    ]);
    const result = buildDefaultVisibleBranches(g);
    expect(result.has("main")).toBe(true);
    expect(result.has("develop")).toBe(true);
    expect(result.has("pr/1")).toBe(true);
    expect(result.has("0.10-stable")).toBe(false);
    expect(result.has("0.11-stable")).toBe(false);
  });

  it("keeps merge-history branches visible in PR mode", () => {
    const g = graph([
      branch({ id: "main", category: "main", isDefault: true }),
      branch({
        id: "history/abc/0",
        category: "feature",
        source: "merge-history",
      }),
      branch({
        id: "pr/1",
        category: "feature",
        source: "pull-request",
        pullNumber: 1,
      }),
    ]);
    const result = buildDefaultVisibleBranches(g);
    expect(result.has("history/abc/0")).toBe(true);
  });

  it("always keeps the default branch visible even if it is 'other'", () => {
    const g = graph([
      branch({ id: "trunk", category: "other", isDefault: true }),
      branch({
        id: "pr/1",
        category: "feature",
        source: "pull-request",
        pullNumber: 1,
      }),
    ]);
    const result = buildDefaultVisibleBranches(g);
    expect(result.has("trunk")).toBe(true);
  });
});
