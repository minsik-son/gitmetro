import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GraphDiagnostics } from "./GraphDiagnostics";
import type { GraphMeta } from "@/lib/github/api-types";

function makeMeta(overrides: Partial<GraphMeta> = {}): GraphMeta {
  return {
    source: "github",
    owner: "x",
    repo: "y",
    truncated: false,
    selectedBranches: 5,
    fetchedCommits: 120,
    maxBranches: 12,
    commitLimit: 500,
    warnings: [],
    history: {
      enabled: true,
      historicalBranches: 0,
      capped: false,
      source: "first-parent-merge",
    },
    prHistory: {
      enabled: true,
      branches: 7,
      capped: false,
      fetchedPulls: 7,
      fetchedPullCommits: 23,
      mode: "reconstructed",
      reconstructedBranches: 7,
      virtualNodes: 14,
      branchOffEdges: 7,
      mergeBackEdges: 6,
    },
    rateLimit: { remaining: 4321 },
    ...overrides,
  };
}

beforeEach(() => cleanup());

describe("GraphDiagnostics", () => {
  it("does not render the popover initially", () => {
    render(<GraphDiagnostics meta={makeMeta()} />);
    expect(screen.queryByTestId("diagnostics-popover")).not.toBeInTheDocument();
  });

  it("opens the popover when the pill is clicked", () => {
    render(<GraphDiagnostics meta={makeMeta()} />);
    fireEvent.click(screen.getByTestId("diagnostics-pill"));
    expect(screen.getByTestId("diagnostics-popover")).toBeInTheDocument();
  });

  it("shows merge lanes, PR lanes, and rate limit", () => {
    render(
      <GraphDiagnostics
        meta={makeMeta({
          history: {
            enabled: true,
            historicalBranches: 3,
            capped: false,
            source: "first-parent-merge",
          },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId("diagnostics-pill"));
    const popover = screen.getByTestId("diagnostics-popover");
    expect(popover).toHaveTextContent(/Merge lanes/);
    expect(popover).toHaveTextContent(/3/);
    expect(popover).toHaveTextContent(/PR lanes/);
    expect(popover).toHaveTextContent(/7/);
    expect(popover).toHaveTextContent(/Rate limit left/);
    expect(popover).toHaveTextContent(/4321/);
  });

  it("renders warnings when present", () => {
    render(
      <GraphDiagnostics
        meta={makeMeta({
          warnings: ["squash merges detected", "PR #5 disconnected"],
        })}
      />,
    );
    fireEvent.click(screen.getByTestId("diagnostics-pill"));
    expect(screen.getByText(/squash merges detected/)).toBeInTheDocument();
    expect(screen.getByText(/PR #5 disconnected/)).toBeInTheDocument();
  });

  it("falls back to zero PR lanes when prHistory meta is missing", () => {
    render(<GraphDiagnostics meta={makeMeta({ prHistory: undefined })} />);
    fireEvent.click(screen.getByTestId("diagnostics-pill"));
    const popover = screen.getByTestId("diagnostics-popover");
    expect(popover).toHaveTextContent(/PR lanes/);
  });

  it("displays PR mode, virtual nodes, branch-off, and merge-back counts when present", () => {
    render(<GraphDiagnostics meta={makeMeta()} />);
    fireEvent.click(screen.getByTestId("diagnostics-pill"));
    const popover = screen.getByTestId("diagnostics-popover");
    expect(popover).toHaveTextContent(/PR mode/);
    expect(popover).toHaveTextContent(/reconstructed/);
    expect(popover).toHaveTextContent(/Virtual nodes/);
    expect(popover).toHaveTextContent(/14/);
    expect(popover).toHaveTextContent(/Branch-off/);
    expect(popover).toHaveTextContent(/Merge-back/);
  });

  it("hides reconstruction-specific rows for legacy mode", () => {
    render(
      <GraphDiagnostics
        meta={makeMeta({
          prHistory: {
            enabled: true,
            branches: 1,
            capped: false,
            fetchedPulls: 1,
            fetchedPullCommits: 2,
            mode: "legacy",
          },
        })}
      />,
    );
    fireEvent.click(screen.getByTestId("diagnostics-pill"));
    const popover = screen.getByTestId("diagnostics-popover");
    expect(popover).toHaveTextContent(/legacy/);
    expect(popover).not.toHaveTextContent(/Virtual nodes/);
    expect(popover).not.toHaveTextContent(/Branch-off/);
    expect(popover).not.toHaveTextContent(/Merge-back/);
  });

  it("closes the popover when the close button is clicked", () => {
    render(<GraphDiagnostics meta={makeMeta()} />);
    fireEvent.click(screen.getByTestId("diagnostics-pill"));
    expect(screen.getByTestId("diagnostics-popover")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/close diagnostics/i));
    expect(screen.queryByTestId("diagnostics-popover")).not.toBeInTheDocument();
  });
});
