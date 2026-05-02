import { describe, it, expect } from "vitest";
import {
  buildLayout,
  rectPath,
  STEP,
  LANE,
  PAD_X,
  PAD_Y,
} from "./buildLayout";
import { MOCK_GRAPH } from "@/data/mockGraph";
import type { BranchLine, CommitNode } from "@/types/gitmetro";

describe("buildLayout horizontal", () => {
  const layout = buildLayout(MOCK_GRAPH.branches, MOCK_GRAPH.commits, "horizontal");

  it("places later t at greater x", () => {
    const a = layout.pos(0, 0);
    const b = layout.pos(5, 0);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it("places branches further from main at greater y", () => {
    const main = layout.pos(0, 0);
    const branch = layout.pos(0, -3);
    expect(branch.y).toBeGreaterThan(main.y);
  });

  it("trends wider than tall for horizontal mock graph", () => {
    expect(layout.width).toBeGreaterThan(layout.height);
  });

  it("indexes every commit in bySha", () => {
    MOCK_GRAPH.commits.forEach((c) => {
      expect(layout.bySha[c.sha]).toBeDefined();
    });
  });
});

describe("buildLayout vertical", () => {
  const layout = buildLayout(MOCK_GRAPH.branches, MOCK_GRAPH.commits, "vertical");

  it("places later t at greater y", () => {
    const a = layout.pos(0, 0);
    const b = layout.pos(5, 0);
    expect(b.y).toBeGreaterThan(a.y);
  });

  it("places branches further from main at greater x", () => {
    const main = layout.pos(0, 0);
    const branch = layout.pos(0, -3);
    expect(branch.x).toBeGreaterThan(main.x);
  });

  it("trends taller than wide for vertical mock graph", () => {
    expect(layout.height).toBeGreaterThan(layout.width);
  });
});

describe("buildLayout edge cases", () => {
  it("does not throw on empty commits", () => {
    const branches: BranchLine[] = [
      { id: "main", name: "main", category: "main", lane: 0, color: "#fff" },
    ];
    const commits: CommitNode[] = [];
    expect(() => buildLayout(branches, commits, "horizontal")).not.toThrow();
  });

  it("uses correct pad and step constants for horizontal pos", () => {
    const layout = buildLayout(
      MOCK_GRAPH.branches,
      MOCK_GRAPH.commits,
      "horizontal",
    );
    const p = layout.pos(2, -1);
    expect(p.x).toBe(PAD_X + 2 * STEP);
    expect(p.y).toBe(PAD_Y + LANE);
  });
});

describe("buildLayout displayT and byNodeId", () => {
  it("uses displayT instead of t when computing position via posForCommit", () => {
    const branches: BranchLine[] = [
      { id: "main", name: "main", category: "main", lane: 0, color: "#fff" },
    ];
    const commits: CommitNode[] = [
      {
        sha: "A",
        shortSha: "A",
        branch: "main",
        t: 0,
        parents: [],
        message: "",
        author: "x",
        date: "",
        isMerge: false,
      },
      {
        sha: "B",
        shortSha: "B",
        branch: "main",
        t: 0,
        displayT: 4,
        parents: [],
        message: "",
        author: "x",
        date: "",
        isMerge: false,
      },
    ];
    const layout = buildLayout(branches, commits, "horizontal");
    const pA = layout.posForCommit(commits[0], 0);
    const pB = layout.posForCommit(commits[1], 0);
    expect(pA.x).toBe(PAD_X + 0 * STEP);
    expect(pB.x).toBe(PAD_X + 4 * STEP);
  });

  it("computes tMax from displayT when present", () => {
    const branches: BranchLine[] = [
      { id: "main", name: "main", category: "main", lane: 0, color: "#fff" },
    ];
    const commits: CommitNode[] = [
      {
        sha: "A",
        shortSha: "A",
        branch: "main",
        t: 1,
        displayT: 7.5,
        parents: [],
        message: "",
        author: "x",
        date: "",
        isMerge: false,
      },
    ];
    const layout = buildLayout(branches, commits, "horizontal");
    expect(layout.tMax).toBe(7.5);
  });

  it("indexes commits by both nodeId and sha in byNodeId", () => {
    const branches: BranchLine[] = [
      { id: "main", name: "main", category: "main", lane: 0, color: "#fff" },
      {
        id: "pr/9",
        name: "pr/9",
        category: "feature",
        lane: -1,
        color: "#0ff",
        source: "pull-request",
      },
    ];
    const commits: CommitNode[] = [
      {
        sha: "A",
        shortSha: "A",
        branch: "main",
        t: 0,
        parents: [],
        message: "",
        author: "x",
        date: "",
        isMerge: false,
      },
      {
        sha: "VS",
        nodeId: "virtual/pr/9/start",
        shortSha: "vs",
        branch: "pr/9",
        t: 1,
        parents: [],
        message: "",
        author: "x",
        date: "",
        isMerge: false,
        isVirtual: true,
        visualKind: "pr-start",
      },
    ];
    const layout = buildLayout(branches, commits, "horizontal");
    expect(layout.byNodeId["A"]).toBe(commits[0]);
    expect(layout.byNodeId["virtual/pr/9/start"]).toBe(commits[1]);
  });
});

describe("rectPath", () => {
  it("returns a non-empty SVG path string for horizontal", () => {
    const d = rectPath({ x: 0, y: 0 }, { x: 100, y: 50 }, "horizontal");
    expect(d).toMatch(/^M 0 0/);
    expect(d).toMatch(/[LAQ]/);
    expect(d.length).toBeGreaterThan(8);
  });

  it("returns a non-empty SVG path string for vertical", () => {
    const d = rectPath({ x: 0, y: 0 }, { x: 50, y: 100 }, "vertical");
    expect(d).toMatch(/^M 0 0/);
    expect(d).toMatch(/[LAQ]/);
    expect(d.length).toBeGreaterThan(8);
  });

  it("falls back to a quad curve for very tight corners", () => {
    const d = rectPath({ x: 0, y: 0 }, { x: 4, y: 4 }, "horizontal");
    expect(d).toMatch(/Q /);
  });
});
