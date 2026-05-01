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
    pullNumber: 42,
  },
];

beforeEach(() => cleanup());

describe("BranchFilterPanel", () => {
  it("renders the Show branch history toggle", () => {
    render(
      <BranchFilterPanel
        branches={branches}
        visible={new Set(branches.map((b) => b.id))}
        toggle={vi.fn()}
        showHistory
        setShowHistory={vi.fn()}
      />,
    );
    expect(screen.getByTestId("show-history-toggle")).toBeInTheDocument();
    expect(screen.getByText(/show branch history/i)).toBeInTheDocument();
  });

  it("calls setShowHistory when toggled", () => {
    const setShowHistory = vi.fn();
    render(
      <BranchFilterPanel
        branches={branches}
        visible={new Set(branches.map((b) => b.id))}
        toggle={vi.fn()}
        showHistory
        setShowHistory={setShowHistory}
      />,
    );
    fireEvent.click(screen.getByTestId("show-history-toggle"));
    expect(setShowHistory).toHaveBeenCalledWith(false);
  });

  it("renders historical branches in a separate History group", () => {
    render(
      <BranchFilterPanel
        branches={branches}
        visible={new Set(branches.map((b) => b.id))}
        toggle={vi.fn()}
        showHistory
        setShowHistory={vi.fn()}
      />,
    );
    const historySectionHeader = screen.getByText(/^History$/);
    expect(historySectionHeader).toBeInTheDocument();
    expect(screen.getByText(/PR #42/)).toBeInTheDocument();
  });

  it("hides the History section when there are no historical branches", () => {
    render(
      <BranchFilterPanel
        branches={branches.filter((b) => !b.isHistorical)}
        visible={new Set(["main", "feature/a"])}
        toggle={vi.fn()}
        showHistory
        setShowHistory={vi.fn()}
      />,
    );
    expect(screen.queryByText(/^History$/)).not.toBeInTheDocument();
  });
});
