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
  zoom?: number;
  pan?: { x: number; y: number };
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
      zoom={overrides?.zoom ?? 1}
      setZoom={setZoom}
      pan={overrides?.pan ?? { x: 0, y: 0 }}
      setPan={setPan}
      onClearSelection={onClearSelection}
    />,
  );

  return {
    ...utils,
    onSelectCommit,
    onHoverChange,
    onClearSelection,
    setZoom,
    setPan,
  };
}

function mockCanvasRect(canvas: Element) {
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 50,
    width: 800,
    height: 600,
    right: 900,
    bottom: 650,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  });
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

  it("renders branch-off, branch, and merge-back route segments for the PR", () => {
    const { container } = setup({ data: reconstructedGraph() });
    expect(
      container.querySelector(
        '[data-testid="route-path-pr/77-branch-off"]',
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="route-path-pr/77-branch"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="route-path-pr/77-merge-back"]'),
    ).toBeInTheDocument();
  });

  it("renders the PR route branch-off as a solid (non-dashed) path", () => {
    const { container } = setup({ data: reconstructedGraph() });
    const off = container.querySelector(
      '[data-testid="route-path-pr/77-branch-off"]',
    );
    expect(off).toBeInTheDocument();
    expect(off?.getAttribute("stroke-dasharray")).toBeFalsy();
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

  it("draws a single-commit PR route as a visible branch path", () => {
    const { container } = setup({ data: reconstructedGraph() });
    expect(
      container.querySelector('[data-testid="route-path-pr/77-branch"]'),
    ).toBeInTheDocument();
  });

  describe("pointer-anchored wheel zoom", () => {
    it("calls setZoom and setPan together on ctrl+wheel", () => {
      const { setZoom, setPan } = setup();
      const canvas = screen.getByTestId("metro-canvas");
      mockCanvasRect(canvas);
      fireEvent.wheel(canvas, {
        ctrlKey: true,
        deltaY: -100,
        clientX: 500,
        clientY: 350,
      });
      expect(setZoom).toHaveBeenCalled();
      expect(setPan).toHaveBeenCalled();
    });

    it("ignores wheel events without ctrl/meta modifier", () => {
      const { setZoom, setPan } = setup();
      const canvas = screen.getByTestId("metro-canvas");
      mockCanvasRect(canvas);
      fireEvent.wheel(canvas, {
        deltaY: -100,
        clientX: 500,
        clientY: 350,
      });
      expect(setZoom).not.toHaveBeenCalled();
      expect(setPan).not.toHaveBeenCalled();
    });

    it("keeps the world point under the cursor pinned on zoom in", () => {
      const { setZoom, setPan } = setup({
        zoom: 1,
        pan: { x: 0, y: 0 },
      });
      const canvas = screen.getByTestId("metro-canvas");
      mockCanvasRect(canvas);
      // Mouse at container-local (400, 300). delta = -(-100)*0.0015 = 0.15.
      fireEvent.wheel(canvas, {
        ctrlKey: true,
        deltaY: -100,
        clientX: 100 + 400,
        clientY: 50 + 300,
      });
      const nextZoom = (setZoom.mock.calls[0][0] as (z: number) => number)(1);
      expect(nextZoom).toBeCloseTo(1.15, 5);
      const nextPan = setPan.mock.calls[0][0] as { x: number; y: number };
      // worldX = 400, worldY = 300. nextPan = anchor - world * nextZoom.
      expect(nextPan.x).toBeCloseTo(400 - 400 * 1.15, 5);
      expect(nextPan.y).toBeCloseTo(300 - 300 * 1.15, 5);
      // Verify invariant: pan + world * nextZoom === anchor.
      const screenAfter = {
        x: nextPan.x + 400 * nextZoom,
        y: nextPan.y + 300 * nextZoom,
      };
      expect(screenAfter.x).toBeCloseTo(400, 5);
      expect(screenAfter.y).toBeCloseTo(300, 5);
    });

    it("keeps the world point pinned on zoom out from a non-zero pan", () => {
      const { setZoom, setPan } = setup({
        zoom: 1.5,
        pan: { x: 220, y: 130 },
      });
      const canvas = screen.getByTestId("metro-canvas");
      mockCanvasRect(canvas);
      // Mouse at container-local (250, 180). delta = -(80)*0.0015 = -0.12.
      fireEvent.wheel(canvas, {
        ctrlKey: true,
        deltaY: 80,
        clientX: 100 + 250,
        clientY: 50 + 180,
      });
      const nextZoom = (setZoom.mock.calls[0][0] as (z: number) => number)(1.5);
      expect(nextZoom).toBeCloseTo(1.38, 5);
      const nextPan = setPan.mock.calls[0][0] as { x: number; y: number };
      const worldX = (250 - 220) / 1.5;
      const worldY = (180 - 130) / 1.5;
      const screenAfter = {
        x: nextPan.x + worldX * nextZoom,
        y: nextPan.y + worldY * nextZoom,
      };
      expect(screenAfter.x).toBeCloseTo(250, 5);
      expect(screenAfter.y).toBeCloseTo(180, 5);
    });

    it("auto-fit does not re-call setZoom/setPan when re-rendered with the same layout", () => {
      // Mock prototype so the canvas div reports a non-zero rect, so the
      // auto-fit effect path actually runs (instead of bailing on rect<50).
      const origRect = HTMLDivElement.prototype.getBoundingClientRect;
      HTMLDivElement.prototype.getBoundingClientRect = function () {
        return {
          left: 0,
          top: 0,
          width: 800,
          height: 600,
          right: 800,
          bottom: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      };
      try {
        const setZoom1 = vi.fn();
        const setPan1 = vi.fn();
        const baseProps = {
          data: MOCK_GRAPH,
          orientation: "horizontal" as const,
          nodeStyle: "ring" as const,
          theme: THEMES["gitmetro-dark"],
          visibleBranches: new Set(MOCK_GRAPH.branches.map((b) => b.id)),
          selectedKey: null,
          onSelectCommit: vi.fn(),
          onHoverChange: vi.fn(),
          zoom: 1,
          pan: { x: 0, y: 0 },
          onClearSelection: vi.fn(),
        };
        const { rerender } = render(
          <MetroMapCanvas
            {...baseProps}
            setZoom={setZoom1}
            setPan={setPan1}
          />,
        );
        // First mount triggered auto-fit once.
        expect(setZoom1).toHaveBeenCalledTimes(1);
        expect(setPan1).toHaveBeenCalledTimes(1);

        // Re-render with NEW setter identities, simulating MapShell re-renders.
        const setZoom2 = vi.fn();
        const setPan2 = vi.fn();
        rerender(
          <MetroMapCanvas
            {...baseProps}
            setZoom={setZoom2}
            setPan={setPan2}
          />,
        );
        // The guard sees the same fit values and skips the redundant updates.
        expect(setZoom2).not.toHaveBeenCalled();
        expect(setPan2).not.toHaveBeenCalled();
      } finally {
        HTMLDivElement.prototype.getBoundingClientRect = origRect;
      }
    });

    it("does not call setZoom/setPan when zoom is already clamped at the boundary", () => {
      const { setZoom, setPan } = setup({
        zoom: 2,
        pan: { x: 0, y: 0 },
      });
      const canvas = screen.getByTestId("metro-canvas");
      mockCanvasRect(canvas);
      // Try to zoom further in past max — clampZoom returns 2, equal to old.
      fireEvent.wheel(canvas, {
        ctrlKey: true,
        deltaY: -1000,
        clientX: 500,
        clientY: 350,
      });
      expect(setZoom).not.toHaveBeenCalled();
      expect(setPan).not.toHaveBeenCalled();
    });
  });

  it("hides PR-related route segments when the PR branch is not visible", () => {
    const { container } = setup({
      data: reconstructedGraph(),
      visible: new Set(["main"]),
    });
    expect(
      container.querySelector(
        '[data-testid="route-path-pr/77-branch-off"]',
      ),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="route-path-pr/77-merge-back"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="route-path-pr/77-branch"]'),
    ).not.toBeInTheDocument();
  });
});
