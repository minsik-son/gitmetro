import { describe, it, expect } from "vitest";
import { MOCK_GRAPH } from "./mockGraph";
import type { BranchCategory } from "@/types/gitmetro";

const ALLOWED: BranchCategory[] = [
  "main",
  "develop",
  "feature",
  "hotfix",
  "release",
  "other",
];

describe("MOCK_GRAPH invariants", () => {
  it("has owner and name on the repo", () => {
    expect(MOCK_GRAPH.repo.owner).toBeTruthy();
    expect(MOCK_GRAPH.repo.name).toBeTruthy();
  });

  it("has at least one branch", () => {
    expect(MOCK_GRAPH.branches.length).toBeGreaterThan(0);
  });

  it("has at least one commit", () => {
    expect(MOCK_GRAPH.commits.length).toBeGreaterThan(0);
  });

  it("references only known branch ids from commits", () => {
    const ids = new Set(MOCK_GRAPH.branches.map((b) => b.id));
    MOCK_GRAPH.commits.forEach((c) => {
      expect(ids.has(c.branch)).toBe(true);
    });
  });

  it("references only known parent shas", () => {
    const shas = new Set(MOCK_GRAPH.commits.map((c) => c.sha));
    MOCK_GRAPH.commits.forEach((c) => {
      c.parents.forEach((p) => {
        expect(shas.has(p)).toBe(true);
      });
    });
  });

  it("merge commits have at least 2 parents", () => {
    MOCK_GRAPH.commits
      .filter((c) => c.isMerge)
      .forEach((c) => {
        expect(c.parents.length).toBeGreaterThanOrEqual(2);
      });
  });

  it("contains at least one head commit", () => {
    const heads = MOCK_GRAPH.commits.filter((c) => c.isHead);
    expect(heads.length).toBeGreaterThan(0);
  });

  it("uses only allowed branch categories", () => {
    MOCK_GRAPH.branches.forEach((b) => {
      expect(ALLOWED).toContain(b.category);
    });
  });
});
