import type { GitMetroGraph } from "@/types/gitmetro";

/**
 * Build the initial visible-branch set for a graph.
 *
 * Policy:
 * - Default branch is always visible.
 * - When PR-history branches exist, hide low-signal `category === "other"`
 *   `source === "ref"` branches by default (e.g. old `*-stable`) so the PR
 *   timeline isn't pushed off-screen.
 * - Otherwise, all branches are visible.
 *
 * The user can still re-enable hidden branches from the BranchFilterPanel.
 */
export function buildDefaultVisibleBranches(graph: GitMetroGraph): Set<string> {
  const visible = new Set<string>();
  const hasPrBranches = graph.branches.some(
    (b) => b.source === "pull-request",
  );

  graph.branches.forEach((branch) => {
    if (branch.isDefault) {
      visible.add(branch.id);
      return;
    }
    if (!hasPrBranches) {
      visible.add(branch.id);
      return;
    }
    if (branch.source === "pull-request" || branch.source === "merge-history") {
      visible.add(branch.id);
      return;
    }
    if (branch.category === "other") {
      // Drop noisy stable / archived ref branches from the initial view.
      return;
    }
    visible.add(branch.id);
  });

  return visible;
}
