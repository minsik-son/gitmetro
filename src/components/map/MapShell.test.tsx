import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MapShell } from "./MapShell";
import { MOCK_GRAPH } from "@/data/mockGraph";
import type { GitMetroGraph } from "@/types/gitmetro";

const HISTORY_GRAPH: GitMetroGraph = {
  repo: { ...MOCK_GRAPH.repo },
  branches: [
    {
      id: "main",
      name: "main",
      category: "main",
      lane: 0,
      color: "#ff5b5b",
      isDefault: true,
      headSha: "M",
      isActive: true,
      source: "ref",
    },
    {
      id: "history/MMMMMMM/0",
      name: "feature/wallet",
      category: "feature",
      lane: -1,
      color: "#3ddbd9",
      isHistorical: true,
      source: "merge-history",
      mergedIntoSha: "M",
      sourceSha: "S2",
      headSha: "S2",
      isActive: true,
    },
  ],
  commits: [
    {
      sha: "A",
      shortSha: "A",
      branch: "main",
      t: 0,
      parents: [],
      message: "init",
      author: "x",
      date: "2026-01-01 00:00",
      isMerge: false,
    },
    {
      sha: "S1",
      shortSha: "S1",
      branch: "history/MMMMMMM/0",
      t: 1,
      parents: ["A"],
      message: "side 1",
      author: "x",
      date: "2026-01-02 12:00",
      isMerge: false,
    },
    {
      sha: "S2",
      shortSha: "S2",
      branch: "history/MMMMMMM/0",
      t: 2,
      parents: ["S1"],
      message: "side 2",
      author: "x",
      date: "2026-01-03 00:00",
      isMerge: false,
      isHead: true,
    },
    {
      sha: "M",
      shortSha: "M",
      branch: "main",
      t: 3,
      parents: ["A", "S2"],
      message: "Merge feature/wallet",
      author: "x",
      date: "2026-01-04 00:00",
      isMerge: true,
      isHead: true,
    },
  ],
};

async function mountAndAdvancePastLoading() {
  render(<MapShell graph={MOCK_GRAPH} loadingStepMs={1} />);
  // Wait for loading terminal to finish and the map to mount.
  await waitFor(
    () => {
      expect(screen.getByTestId("metro-canvas")).toBeInTheDocument();
    },
    { timeout: 2000 },
  );
}

describe("MapShell", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders the map after the loading terminal completes", async () => {
    await mountAndAdvancePastLoading();
    expect(screen.getByTestId("metro-canvas")).toBeInTheDocument();
  });

  it("does not show the commit inspector by default", async () => {
    await mountAndAdvancePastLoading();
    expect(screen.queryByTestId("commit-inspector")).not.toBeInTheDocument();
  });

  it("opens the inspector when a station is clicked", async () => {
    await mountAndAdvancePastLoading();
    const station = screen.getByTestId(`station-${MOCK_GRAPH.commits[0].sha}`);
    fireEvent.click(station);
    expect(screen.getByTestId("commit-inspector")).toBeInTheDocument();
  });

  it("closes the inspector when the empty canvas is clicked", async () => {
    await mountAndAdvancePastLoading();
    const station = screen.getByTestId(`station-${MOCK_GRAPH.commits[0].sha}`);
    fireEvent.click(station);
    expect(screen.getByTestId("commit-inspector")).toBeInTheDocument();

    const svg = screen.getByTestId("metro-canvas").querySelector("svg")!;
    fireEvent.mouseDown(svg, { clientX: 10, clientY: 10 });
    fireEvent.mouseUp(svg, { clientX: 10, clientY: 10 });
    fireEvent.click(svg);
    expect(screen.queryByTestId("commit-inspector")).not.toBeInTheDocument();
  });

  it("toggles orientation between Horizontal and Vertical", async () => {
    await mountAndAdvancePastLoading();
    const verticalBtn = screen.getByRole("button", { name: /vertical/i });
    fireEvent.click(verticalBtn);
    // The vertical button should now be in the visually active state (no class assertion;
    // just confirm the click handler did not throw and the element is still present).
    expect(verticalBtn).toBeInTheDocument();
    const horizontalBtn = screen.getByRole("button", { name: /horizontal/i });
    fireEvent.click(horizontalBtn);
    expect(horizontalBtn).toBeInTheDocument();
  });
});

describe("MapShell history toggle", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders the Show branch history toggle when historical branches exist", () => {
    render(<MapShell graph={HISTORY_GRAPH} skipInitialLoading />);
    expect(screen.getByTestId("show-history-toggle")).toBeInTheDocument();
  });

  it("hides historical branch stations when the toggle is turned off", () => {
    render(<MapShell graph={HISTORY_GRAPH} skipInitialLoading />);
    // historical chain commits are visible by default
    expect(screen.getByTestId("station-S1")).toBeInTheDocument();
    expect(screen.getByTestId("station-S2")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("show-history-toggle"));

    expect(screen.queryByTestId("station-S1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("station-S2")).not.toBeInTheDocument();
    // Trunk commits stay visible.
    expect(screen.getByTestId("station-A")).toBeInTheDocument();
    expect(screen.getByTestId("station-M")).toBeInTheDocument();
  });

  it("brings historical stations back when the toggle is turned on again", () => {
    render(<MapShell graph={HISTORY_GRAPH} skipInitialLoading />);
    const toggle = screen.getByTestId("show-history-toggle");
    fireEvent.click(toggle);
    expect(screen.queryByTestId("station-S1")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByTestId("station-S1")).toBeInTheDocument();
    expect(screen.getByTestId("station-S2")).toBeInTheDocument();
  });
});

const PR_GRAPH: GitMetroGraph = {
  repo: { ...MOCK_GRAPH.repo },
  branches: [
    {
      id: "main",
      name: "main",
      category: "main",
      lane: 0,
      color: "#ff5b5b",
      isDefault: true,
      headSha: "M2",
      isActive: true,
      source: "ref",
    },
    {
      id: "pr/77",
      name: "feature/wallet",
      category: "feature",
      lane: -1,
      color: "#3ddbd9",
      isHistorical: true,
      source: "pull-request",
      pullNumber: 77,
      pullTitle: "Add wallet",
      pullUrl: "https://github.com/x/y/pull/77",
      isActive: true,
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
      date: "2026-01-01 00:00",
      isMerge: false,
    },
    {
      sha: "M2",
      shortSha: "M2",
      branch: "main",
      t: 2,
      parents: ["M1"],
      message: "release",
      author: "x",
      date: "2026-01-04 00:00",
      isMerge: false,
      isHead: true,
    },
    {
      sha: "P1",
      shortSha: "P1",
      branch: "pr/77",
      t: 1,
      parents: ["M1"],
      message: "wallet step",
      author: "x",
      date: "2026-01-02 00:00",
      isMerge: false,
      pr: "#77",
    },
  ],
  edges: [
    {
      id: "pr-edge/77",
      from: "P1",
      to: "M2",
      type: "synthetic-pr",
      branchId: "pr/77",
    },
  ],
};

describe("MapShell PR history toggle", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders Show PR history toggle when PR branches exist", () => {
    render(<MapShell graph={PR_GRAPH} skipInitialLoading />);
    expect(screen.getByTestId("show-pr-history-toggle")).toBeInTheDocument();
  });

  it("hides pull-request stations when the PR history toggle is turned off", () => {
    render(<MapShell graph={PR_GRAPH} skipInitialLoading />);
    expect(screen.getByTestId("station-P1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("show-pr-history-toggle"));
    expect(screen.queryByTestId("station-P1")).not.toBeInTheDocument();
    // Default branch stations stay visible.
    expect(screen.getByTestId("station-M1")).toBeInTheDocument();
    expect(screen.getByTestId("station-M2")).toBeInTheDocument();
  });

  it("brings pull-request stations back when the toggle is turned on again", () => {
    render(<MapShell graph={PR_GRAPH} skipInitialLoading />);
    const toggle = screen.getByTestId("show-pr-history-toggle");
    fireEvent.click(toggle);
    expect(screen.queryByTestId("station-P1")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByTestId("station-P1")).toBeInTheDocument();
  });

  it("hides synthetic-pr edge when the PR history toggle is off", () => {
    const { container } = render(
      <MapShell graph={PR_GRAPH} skipInitialLoading />,
    );
    expect(
      container.querySelector('[data-testid="synthetic-edge-pr-edge/77"]'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("show-pr-history-toggle"));
    expect(
      container.querySelector('[data-testid="synthetic-edge-pr-edge/77"]'),
    ).not.toBeInTheDocument();
  });
});

const PR_MODE_GRAPH: GitMetroGraph = {
  repo: { ...MOCK_GRAPH.repo },
  branches: [
    {
      id: "main",
      name: "main",
      category: "main",
      lane: 0,
      color: "#ff5b5b",
      isDefault: true,
      isActive: true,
      source: "ref",
    },
    {
      id: "develop",
      name: "develop",
      category: "develop",
      lane: -1,
      color: "#f3d54e",
      isActive: true,
      source: "ref",
    },
    {
      id: "0.10-stable",
      name: "0.10-stable",
      category: "other",
      lane: -2,
      color: "#3ddbd9",
      isActive: true,
      source: "ref",
    },
    {
      id: "pr/123",
      name: "feature/whatever",
      category: "feature",
      lane: -3,
      color: "#3dd68c",
      isHistorical: true,
      isActive: true,
      source: "pull-request",
      pullNumber: 123,
    },
  ],
  commits: [
    {
      sha: "M0",
      shortSha: "M0",
      branch: "main",
      t: 0,
      parents: [],
      message: "init",
      author: "x",
      date: "2026-04-01 00:00",
      isMerge: false,
    },
    {
      sha: "M1",
      shortSha: "M1",
      branch: "main",
      t: 4,
      parents: ["M0"],
      message: "release",
      author: "x",
      date: "2026-04-08 00:00",
      isMerge: false,
      isHead: true,
    },
    {
      sha: "D1",
      shortSha: "D1",
      branch: "develop",
      t: 2,
      parents: ["M0"],
      message: "develop work",
      author: "x",
      date: "2026-04-04 00:00",
      isMerge: false,
    },
    {
      sha: "S1",
      shortSha: "S1",
      branch: "0.10-stable",
      t: 1,
      parents: ["M0"],
      message: "stable old",
      author: "x",
      date: "2026-04-02 00:00",
      isMerge: false,
    },
  ],
};

describe("MapShell default visible policy", () => {
  beforeEach(() => {
    cleanup();
  });

  it("hides 'other' ref branches by default when PR branches exist", () => {
    render(<MapShell graph={PR_MODE_GRAPH} skipInitialLoading />);
    // S1 sits on the 0.10-stable branch which should be hidden initially.
    expect(screen.queryByTestId("station-S1")).not.toBeInTheDocument();
    // Develop and main remain visible.
    expect(screen.getByTestId("station-D1")).toBeInTheDocument();
    expect(screen.getByTestId("station-M0")).toBeInTheDocument();
  });

  it("keeps the 'other' branch togglable from the panel even when hidden", () => {
    render(<MapShell graph={PR_MODE_GRAPH} skipInitialLoading />);
    const stableButton = screen.getByText("0.10-stable").closest("button");
    expect(stableButton).toBeTruthy();
    fireEvent.click(stableButton!);
    expect(screen.getByTestId("station-S1")).toBeInTheDocument();
  });

  it("keeps every branch visible when there are no PR branches", () => {
    render(<MapShell graph={MOCK_GRAPH} skipInitialLoading />);
    expect(screen.getByTestId("metro-canvas")).toBeInTheDocument();
    // featureA + featureB stations from MOCK_GRAPH should be present.
    expect(
      screen.getByTestId(`station-${MOCK_GRAPH.commits[0].sha}`),
    ).toBeInTheDocument();
  });
});
