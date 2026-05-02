import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MetroMapCanvas } from "./MetroMapCanvas";
import { THEMES } from "@/lib/theme/themes";
import { MOCK_GRAPH } from "@/data/mockGraph";
import type { GitMetroGraph } from "@/types/gitmetro";

function setup(overrides?: {
  data?: GitMetroGraph;
  visible?: Set<string>;
  selectedKey?: string | null;
}) {
  const onSelectCommit = vi.fn();
  const onHoverChange = vi.fn();
  const onClearSelection = vi.fn();
  const setZoom = vi.fn();
  const setPan = vi.fn();

  const data = overrides?.data ?? MOCK_GRAPH;

  const utils = render(
    <MetroMapCanvas
      data={data}
      orientation="horizontal"
      nodeStyle="ring"
      theme={THEMES["gitmetro-dark"]}
      visibleBranches={
        overrides?.visible ?? new Set(data.branches.map((b) => b.id))
      }
      selectedKey={overrides?.selectedKey ?? null}
      onSelectCommit={onSelectCommit}
      onHoverChange={onHoverChange}
      zoom={1}
      setZoom={setZoom}
      pan={{ x: 0, y: 0 }}
      setPan={setPan}
      onClearSelection={onClearSelection}
    />,
  );

  return { ...utils, onSelectCommit, onHoverChange, onClearSelection };
}

describe("MetroMapCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the canvas wrapper", () => {
    setup();
    expect(screen.getByTestId("metro-canvas")).toBeInTheDocument();
  });

  it("renders only stations on visible branches", () => {
    const onlyMain = new Set(["main"]);
    setup({ visible: onlyMain });
    const mainCommits = MOCK_GRAPH.commits.filter((c) => c.branch === "main");
    const featureCommits = MOCK_GRAPH.commits.filter(
      (c) => c.branch === "featureA",
    );
    mainCommits.forEach((c) => {
      expect(screen.getByTestId(`station-${c.sha}`)).toBeInTheDocument();
    });
    featureCommits.forEach((c) => {
      expect(screen.queryByTestId(`station-${c.sha}`)).not.toBeInTheDocument();
    });
  });

  it("calls onHoverChange on station mouse enter and onHoverChange(null) on leave", () => {
    const { onHoverChange } = setup();
    const station = screen.getByTestId(
      `station-${MOCK_GRAPH.commits[0].sha}`,
    );
    fireEvent.mouseEnter(station);
    expect(onHoverChange).toHaveBeenCalled();
    const lastCall = onHoverChange.mock.calls[onHoverChange.mock.calls.length - 1][0];
    expect(lastCall?.commit.sha).toBe(MOCK_GRAPH.commits[0].sha);

    onHoverChange.mockClear();
    fireEvent.mouseLeave(station);
    expect(onHoverChange).toHaveBeenCalledWith(null);
  });

  it("calls onSelectCommit on station click and does not bubble to background clear", () => {
    const { onSelectCommit, onClearSelection } = setup();
    const station = screen.getByTestId(
      `station-${MOCK_GRAPH.commits[0].sha}`,
    );
    fireEvent.click(station);
    expect(onSelectCommit).toHaveBeenCalledTimes(1);
    expect(onSelectCommit.mock.calls[0][0].sha).toBe(MOCK_GRAPH.commits[0].sha);
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it("calls onClearSelection when the empty SVG background is clicked without dragging", () => {
    const { onClearSelection } = setup();
    const canvas = screen.getByTestId("metro-canvas");
    const svg = canvas.querySelector("svg")!;
    fireEvent.mouseDown(svg, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(svg, { clientX: 50, clientY: 50 });
    fireEvent.click(svg);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("does not call onClearSelection after a drag-pan ends with mouseup far from start", () => {
    const { onClearSelection } = setup();
    const canvas = screen.getByTestId("metro-canvas");
    const svg = canvas.querySelector("svg")!;
    fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 220, clientY: 220 });
    fireEvent.mouseUp(window, { clientX: 220, clientY: 220 });
    fireEvent.click(svg);
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it("renders synthetic-pr edges from data.edges", () => {
    const data: GitMetroGraph = {
      repo: { ...MOCK_GRAPH.repo },
      branches: [
        {
          id: "main",
          name: "main",
          category: "main",
          color: "#ff5b5b",
          lane: 0,
          isDefault: true,
        },
        {
          id: "pr/9",
          name: "feature/x",
          category: "feature",
          color: "#3ddbd9",
          lane: -1,
          isHistorical: true,
          source: "pull-request",
          pullNumber: 9,
        },
      ],
      commits: [
        {
          sha: "M1",
          shortSha: "M1",
          branch: "main",
          t: 0,
          parents: [],
          message: "init",
          author: "x",
          date: "2026-01-01",
          isMerge: false,
        },
        {
          sha: "M2",
          shortSha: "M2",
          branch: "main",
          t: 2,
          parents: ["M1"],
          message: "tip",
          author: "x",
          date: "2026-01-03",
          isMerge: false,
        },
        {
          sha: "P1",
          shortSha: "P1",
          branch: "pr/9",
          t: 1,
          parents: [],
          message: "pr",
          author: "x",
          date: "2026-01-02",
          isMerge: false,
        },
      ],
      edges: [
        {
          id: "pr-edge/9",
          from: "P1",
          to: "M2",
          type: "synthetic-pr",
          branchId: "pr/9",
        },
      ],
    };
    const { container } = setup({ data });
    expect(
      container.querySelector('[data-testid="synthetic-edge-pr-edge/9"]'),
    ).toBeInTheDocument();
  });

  it("hides synthetic-pr edge when the PR branch is not visible", () => {
    const data: GitMetroGraph = {
      repo: { ...MOCK_GRAPH.repo },
      branches: [
        {
          id: "main",
          name: "main",
          category: "main",
          color: "#ff5b5b",
          lane: 0,
          isDefault: true,
        },
        {
          id: "pr/9",
          name: "feature/x",
          category: "feature",
          color: "#3ddbd9",
          lane: -1,
          isHistorical: true,
          source: "pull-request",
          pullNumber: 9,
        },
      ],
      commits: [
        {
          sha: "M2",
          shortSha: "M2",
          branch: "main",
          t: 2,
          parents: [],
          message: "tip",
          author: "x",
          date: "2026-01-03",
          isMerge: false,
        },
        {
          sha: "P1",
          shortSha: "P1",
          branch: "pr/9",
          t: 1,
          parents: [],
          message: "pr",
          author: "x",
          date: "2026-01-02",
          isMerge: false,
        },
      ],
      edges: [
        {
          id: "pr-edge/9",
          from: "P1",
          to: "M2",
          type: "synthetic-pr",
          branchId: "pr/9",
        },
      ],
    };
    const { container } = setup({ data, visible: new Set(["main"]) });
    expect(
      container.querySelector('[data-testid="synthetic-edge-pr-edge/9"]'),
    ).not.toBeInTheDocument();
  });

  function reconstructedGraph(): GitMetroGraph {
    return {
      repo: { ...MOCK_GRAPH.repo },
      branches: [
        {
          id: "main",
          name: "main",
          category: "main",
          color: "#ff5b5b",
          lane: 0,
          isDefault: true,
        },
        {
          id: "pr/77",
          name: "feature/timeline",
          category: "feature",
          color: "#3ddbd9",
          lane: -1,
          isHistorical: true,
          source: "pull-request",
          pullNumber: 77,
        },
      ],
      commits: [
        {
          sha: "M1",
          shortSha: "M1",
          branch: "main",
          t: 0,
          parents: [],
          message: "init",
          author: "x",
          date: "2026-01-01",
          isMerge: false,
        },
        {
          sha: "M2",
          shortSha: "M2",
          branch: "main",
          t: 4,
          parents: ["M1"],
          message: "release",
          author: "x",
          date: "2026-01-04",
          isMerge: false,
          isHead: true,
        },
        {
          sha: "virtual/pr/77/start",
          nodeId: "virtual/pr/77/start",
          shortSha: "open",
          branch: "pr/77",
          t: 0.35,
          displayT: 0.35,
          parents: ["M1"],
          message: "PR #77 opened",
          author: "alice",
          date: "2026-01-02",
          isMerge: false,
          isVirtual: true,
          visualKind: "pr-start",
          pr: "#77",
        },
        {
          sha: "C1",
          nodeId: "pr/77/commit/C1",
          realSha: "C1",
          shortSha: "C1",
          branch: "pr/77",
          t: 2,
          displayT: 2,
          parents: ["virtual/pr/77/start"],
          message: "wip",
          author: "alice",
          date: "2026-01-03",
          isMerge: false,
          visualKind: "commit",
          pr: "#77",
        },
        {
          sha: "virtual/pr/77/end",
          nodeId: "virtual/pr/77/end",
          shortSha: "merge",
          branch: "pr/77",
          t: 3.65,
          displayT: 3.65,
          parents: ["pr/77/commit/C1"],
          message: "PR #77 merged",
          author: "alice",
          date: "2026-01-04",
          isMerge: true,
          isVirtual: true,
          visualKind: "pr-end",
          pr: "#77",
        },
      ],
      edges: [
        {
          id: "pr-off/77",
          from: "M1",
          to: "virtual/pr/77/start",
          type: "pr-branch-off",
          branchId: "pr/77",
        },
        {
          id: "pr-chain/77/start",
          from: "virtual/pr/77/start",
          to: "pr/77/commit/C1",
          type: "pr-chain",
          branchId: "pr/77",
        },
        {
          id: "pr-chain/77/end",
          from: "pr/77/commit/C1",
          to: "virtual/pr/77/end",
          type: "pr-chain",
          branchId: "pr/77",
        },
        {
          id: "pr-back/77",
          from: "virtual/pr/77/end",
          to: "M2",
          type: "pr-merge-back",
          branchId: "pr/77",
        },
      ],
    };
  }

  it("renders pr-branch-off, pr-merge-back, and pr-chain edges", () => {
    const { container } = setup({ data: reconstructedGraph() });
    expect(
      container.querySelector('[data-testid="pr-branch-off-edge-pr-off/77"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="pr-merge-back-edge-pr-back/77"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '[data-testid="pr-chain-edge-pr-chain/77/start"]',
      ),
    ).toBeInTheDocument();
  });

  it("renders virtual pr-start and pr-end stations", () => {
    setup({ data: reconstructedGraph() });
    expect(
      screen.getByTestId("station-virtual/pr/77/start"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("station-virtual/pr/77/end"),
    ).toBeInTheDocument();
  });

  it("draws a single-commit PR branch chain (chain length >= 2)", () => {
    const { container } = setup({ data: reconstructedGraph() });
    expect(
      container.querySelector('[data-testid="branch-chain-pr/77"]'),
    ).toBeInTheDocument();
  });

  it("hides PR-related edges when the PR branch is not visible", () => {
    const { container } = setup({
      data: reconstructedGraph(),
      visible: new Set(["main"]),
    });
    expect(
      container.querySelector('[data-testid="pr-branch-off-edge-pr-off/77"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="pr-merge-back-edge-pr-back/77"]'),
    ).not.toBeInTheDocument();
  });
});
