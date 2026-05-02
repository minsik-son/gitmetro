import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BranchFilterPanel } from "./BranchFilterPanel";
import type { BranchLine } from "@/types/gitmetro";

const branches: BranchLine[] = [
  {
    id: "main",
    name: "main",
    category: "main",
    color: "#fff",
    lane: 0,
    isDefault: true,
  },
  {
    id: "feature/a",
    name: "feature/a",
    category: "feature",
    color: "#0ff",
    lane: -1,
  },
  {
    id: "history/x/0",
    name: "history/x",
    category: "feature",
    color: "#0f0",
    lane: -2,
    isHistorical: true,
    source: "merge-history",
    pullNumber: 42,
  },
  {
    id: "pr/55",
    name: "feature/synth",
    category: "feature",
    color: "#f0f",
    lane: -3,
    isHistorical: true,
    source: "pull-request",
    pullNumber: 55,
    pullTitle: "Add synthesizer",
    pullUrl: "https://github.com/o/r/pull/55",
  },
];

function defaultProps() {
  return {
    branches,
    visible: new Set(branches.map((b) => b.id)),
    toggle: vi.fn(),
    showHistory: true,
    setShowHistory: vi.fn(),
    showPrHistory: true,
    setShowPrHistory: vi.fn(),
  };
}

beforeEach(() => cleanup());

describe("BranchFilterPanel", () => {
  it("renders the Show branch history toggle", () => {
    render(<BranchFilterPanel {...defaultProps()} />);
    expect(screen.getByTestId("show-history-toggle")).toBeInTheDocument();
    expect(screen.getByText(/show branch history/i)).toBeInTheDocument();
  });

  it("renders the Show PR history toggle", () => {
    render(<BranchFilterPanel {...defaultProps()} />);
    expect(screen.getByTestId("show-pr-history-toggle")).toBeInTheDocument();
    expect(screen.getByText(/show pr history/i)).toBeInTheDocument();
  });

  it("calls setShowHistory when toggled", () => {
    const setShowHistory = vi.fn();
    render(
      <BranchFilterPanel {...defaultProps()} setShowHistory={setShowHistory} />,
    );
    fireEvent.click(screen.getByTestId("show-history-toggle"));
    expect(setShowHistory).toHaveBeenCalledWith(false);
  });

  it("calls setShowPrHistory when toggled", () => {
    const setShowPrHistory = vi.fn();
    render(
      <BranchFilterPanel
        {...defaultProps()}
        setShowPrHistory={setShowPrHistory}
      />,
    );
    fireEvent.click(screen.getByTestId("show-pr-history-toggle"));
    expect(setShowPrHistory).toHaveBeenCalledWith(false);
  });

  it("disables the PR history toggle when no PR branches are present", () => {
    render(
      <BranchFilterPanel
        {...defaultProps()}
        branches={branches.filter((b) => b.source !== "pull-request")}
      />,
    );
    const toggle = screen.getByTestId(
      "show-pr-history-toggle",
    ) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
  });

  it("renders historical branches in a separate History group", () => {
    render(<BranchFilterPanel {...defaultProps()} />);
    const historySectionHeader = screen.getByText(/^History$/);
    expect(historySectionHeader).toBeInTheDocument();
    expect(screen.getByText(/PR #42/)).toBeInTheDocument();
    expect(screen.getByText(/PR #55/)).toBeInTheDocument();
  });

  it("hides the History section when there are no historical branches", () => {
    render(
      <BranchFilterPanel
        {...defaultProps()}
        branches={branches.filter((b) => !b.isHistorical)}
        visible={new Set(["main", "feature/a"])}
      />,
    );
    expect(screen.queryByText(/^History$/)).not.toBeInTheDocument();
  });
});
