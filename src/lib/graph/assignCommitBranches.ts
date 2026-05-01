import type { GitHubCommitListItem } from "@/lib/github/types";
import type { SelectedBranch } from "./branchSelection";

export interface AssignmentInput {
  selected: SelectedBranch[];
  /** Newest-first list of commits per selected branch name (as GitHub returns). */
  commitsByBranch: Record<string, GitHubCommitListItem[]>;
}

export interface AssignmentResult {
  /** Maps every fetched commit sha to the branch name that should own its lane. */
  primaryByCommit: Record<string, string>;
}

/**
 * Pick exactly one branch per commit so each commit lands on a single lane.
 *
 * Algorithm v1:
 *  - The default branch claims every commit it sees first.
 *  - Remaining branches are processed in the order they appear in `selected`.
 *    Each branch walks its own commit list newest → oldest and claims any
 *    commit not yet assigned. As soon as it hits a commit that is already
 *    assigned, that branch stops walking — that's the shared ancestor.
 *
 * This produces clean unique segments per branch while letting fully-merged
 * branches naturally have no segment of their own (their head was merged into
 * default).
 */
export function assignCommitBranches(input: AssignmentInput): AssignmentResult {
  const primaryByCommit: Record<string, string> = {};

  const defaultBranch = input.selected.find((b) => b.isDefault);
  if (defaultBranch) {
    const defaultCommits = input.commitsByBranch[defaultBranch.name] ?? [];
    defaultCommits.forEach((c) => {
      if (!primaryByCommit[c.sha]) {
        primaryByCommit[c.sha] = defaultBranch.name;
      }
    });
  }

  for (const branch of input.selected) {
    if (branch.isDefault) continue;
    const list = input.commitsByBranch[branch.name] ?? [];
    for (const commit of list) {
      if (primaryByCommit[commit.sha]) {
        // Hit a commit already assigned (including via default): stop walking
        // this branch — we've reached its merge point with an earlier branch.
        break;
      }
      primaryByCommit[commit.sha] = branch.name;
    }
  }

  return { primaryByCommit };
}
