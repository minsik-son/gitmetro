import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MetroMapCanvas } from "./MetroMapCanvas";
import { THEMES } from "@/lib/theme/themes";
import { MOCK_GRAPH } from "@/data/mockGraph";

function setup(overrides?: {
  visible?: Set<string>;
  selectedSha?: string | null;
}) {
  const onSelectCommit = vi.fn();
  const onHoverChange = vi.fn();
  const onClearSelection = vi.fn();
  const setZoom = vi.fn();
  const setPan = vi.fn();

  const utils = render(
    <MetroMapCanvas
      data={MOCK_GRAPH}
      orientation="horizontal"
      nodeStyle="ring"
      theme={THEMES["gitmetro-dark"]}
      visibleBranches={
        overrides?.visible ?? new Set(MOCK_GRAPH.branches.map((b) => b.id))
      }
      selectedSha={overrides?.selectedSha ?? null}
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
});
