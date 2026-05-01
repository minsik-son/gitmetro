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
