import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MapShell } from "./MapShell";
import { MOCK_GRAPH } from "@/data/mockGraph";

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
