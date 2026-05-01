import { classifyBranchName } from "@/lib/github/branchCategory";
import { THEMES, colorForCategory } from "@/lib/theme/themes";
import type { GitHubCommitListItem } from "@/lib/github/types";
import type { BranchLine } from "@/types/gitmetro";

export interface HistoricalExtractionInput {
  /** Every fetched commit, indexed by sha. */
  bySha: Record<string, GitHubCommitListItem>;
  /** Default branch first-parent trunk set. */
  trunkSet: Set<string>;
  /** Commits already assigned to a branch by `assignCommitBranches`. */
  primaryByCommit: Record<string, string>;
  /** Maximum number of historical branches to extract. */
  historyLimit: number;
  /** Maximum number of commits to walk per second-parent chain. */
  historyCommitLimit: number;
}

export interface HistoricalExtractionResult {
  branches: BranchLine[];
  /** sha -> historical branch id; merge with the existing primaryByCommit map. */
  historicalAssignment: Record<string, string>;
  capped: boolean;
  /** True when at least one chain hit historyCommitLimit while walking. */
  chainCapped: boolean;
}

interface MergeInfo {
  branchName: string | null;
  pullNumber: number | undefined;
}

/**
 * Parse a merge commit message to recover the source branch name and PR number
 * when present. We support GitHub's most common merge formats:
 *
 *  - "Merge pull request #1234 from owner/branch-name"
 *  - "Merge branch 'feature/foo' into main"
 *  - "Merge branch 'feature/foo'"
 *  - "Merge remote-tracking branch 'origin/feature/foo' into main"
 *
 * Anything else returns nulls and the caller falls back to a synthetic name.
 */
export function parseMergeMessage(message: string): MergeInfo {
  const firstLine = message.split("\n")[0] ?? "";

  const pr = /^Merge pull request #(\d+) from ([^\s]+)/i.exec(firstLine);
  if (pr) {
    const tail = pr[2];
    // tail looks like "owner/branch-name" — strip the owner prefix.
    const slash = tail.indexOf("/");
    const branchName = slash === -1 ? tail : tail.slice(slash + 1);
    return { branchName, pullNumber: Number(pr[1]) };
  }

  const remote = /^Merge remote-tracking branch ['"]([^'"]+)['"]/i.exec(firstLine);
  if (remote) {
    const value = remote[1];
    const stripped = value.replace(/^origin\//i, "").replace(/^upstream\//i, "");
    return { branchName: stripped, pullNumber: undefined };
  }

  const local = /^Merge branch ['"]([^'"]+)['"]/i.exec(firstLine);
  if (local) {
    return { branchName: local[1], pullNumber: undefined };
  }

  return { branchName: null, pullNumber: undefined };
}

function commitDate(c: GitHubCommitListItem): number {
  const candidate = c.commit.author?.date ?? c.commit.committer?.date;
  if (!candidate) return 0;
  const t = Date.parse(candidate);
  return Number.isFinite(t) ? t : 0;
}

export function extractHistoricalBranches(
  input: HistoricalExtractionInput,
): HistoricalExtractionResult {
  const branches: BranchLine[] = [];
  const historicalAssignment: Record<string, string> = {};
  let chainCapped = false;
  const themeTokens = THEMES["gitmetro-dark"];

  // Find merge commits that live on the trunk, sorted newest → oldest.
  const trunkMerges = Array.from(input.trunkSet)
    .map((sha) => input.bySha[sha])
    .filter((c): c is GitHubCommitListItem => !!c && c.parents.length > 1)
    .sort((a, b) => commitDate(b) - commitDate(a));

  let capped = false;

  for (const merge of trunkMerges) {
    if (branches.length >= input.historyLimit) {
      capped = true;
      break;
    }
    // Use parents[1..] — second and later parents (Octopus merges land here too).
    const sideParents = merge.parents.slice(1);
    for (let parentIdx = 0; parentIdx < sideParents.length; parentIdx++) {
      if (branches.length >= input.historyLimit) {
        capped = true;
        break;
      }
      const startSha = sideParents[parentIdx].sha;
      const chain: string[] = [];
      let cursor: string | undefined = startSha;
      while (cursor) {
        if (chain.length >= input.historyCommitLimit) {
          chainCapped = true;
          break;
        }
        const node: GitHubCommitListItem | undefined = input.bySha[cursor];
        if (!node) break;
        if (input.trunkSet.has(cursor)) break;
        if (input.primaryByCommit[cursor] != null) break;
        if (historicalAssignment[cursor] != null) break;
        chain.push(cursor);
        cursor = node.parents[0]?.sha;
      }
      if (chain.length === 0) continue;

      const mergeShortSha = merge.sha.slice(0, 7);
      const branchId = `history/${mergeShortSha}/${parentIdx}`;
      const parsed = parseMergeMessage(merge.commit.message);
      const synthetic = `merge/${mergeShortSha}`;
      const branchName = parsed.branchName ?? synthetic;
      const category = parsed.branchName
        ? classifyBranchName(parsed.branchName)
        : "feature";

      branches.push({
        id: branchId,
        name: branchName,
        category,
        color: colorForCategory(themeTokens, category),
        lane: 0, // re-packed by caller
        headSha: chain[0],
        isHistorical: true,
        source: "merge-history",
        mergedIntoSha: merge.sha,
        sourceSha: startSha,
        pullNumber: parsed.pullNumber,
        isActive: true,
      });

      chain.forEach((sha) => {
        historicalAssignment[sha] = branchId;
      });
    }
  }

  return {
    branches,
    historicalAssignment,
    capped,
    chainCapped,
  };
}
