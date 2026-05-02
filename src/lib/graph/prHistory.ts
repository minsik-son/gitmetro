import { classifyBranchName } from "@/lib/github/branchCategory";
import { THEMES, colorForCategory } from "@/lib/theme/themes";
import type {
  GitHubCommitListItem,
  GitHubPullRequestListItem,
} from "@/lib/github/types";
import type {
  BranchLine,
  CommitNode,
  GraphEdge,
} from "@/types/gitmetro";

export interface PrHistoryInput {
  pulls: GitHubPullRequestListItem[];
  commitsByPull: Record<number, GitHubCommitListItem[]>;
  existingBranches: BranchLine[];
  existingCommitsBySha: Record<string, CommitNode>;
  defaultBranchName: string;
  startLane: number;
  prHistoryLimit: number;
  prCommitLimit: number;
}

export interface PrHistoryResult {
  branches: BranchLine[];
  commits: CommitNode[];
  edges: GraphEdge[];
  warnings: string[];
  capped: boolean;
  fetchedPulls: number;
  fetchedPullCommits: number;
}

function firstLine(message: string): string {
  const idx = message.indexOf("\n");
  return idx === -1 ? message : message.slice(0, idx);
}

function pickAuthorName(raw: GitHubCommitListItem): string {
  if (raw.author?.login) return raw.author.login;
  return raw.commit.author?.name ?? raw.commit.committer?.name ?? "unknown";
}

function pickAvatar(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (cleaned.length === 0) return "??";
  return cleaned.slice(0, 2);
}

function formatDate(candidate: string | null | undefined): string {
  if (!candidate) return "";
  const d = new Date(candidate);
  if (Number.isNaN(d.getTime())) return candidate;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function pickEpoch(raw: GitHubCommitListItem): number {
  const candidate = raw.commit.author?.date ?? raw.commit.committer?.date;
  if (!candidate) return 0;
  const t = Date.parse(candidate);
  return Number.isFinite(t) ? t : 0;
}

function epochFromDateString(date: string): number {
  if (!date) return 0;
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface DefaultCommitEpoch {
  sha: string;
  t: number;
  epoch: number;
}

function buildDefaultBranchEpochIndex(
  existingCommitsBySha: Record<string, CommitNode>,
  defaultBranchName: string,
): DefaultCommitEpoch[] {
  return Object.values(existingCommitsBySha)
    .filter((c) => c.branch === defaultBranchName)
    .map((c) => ({
      sha: c.sha,
      t: c.t,
      epoch: epochFromDateString(c.date),
    }))
    .sort((a, b) => a.epoch - b.epoch);
}

function pickTargetSha(
  pull: GitHubPullRequestListItem,
  existingCommitsBySha: Record<string, CommitNode>,
  defaultBranchEpoch: DefaultCommitEpoch[],
): string | null {
  if (
    pull.merge_commit_sha &&
    existingCommitsBySha[pull.merge_commit_sha]
  ) {
    return pull.merge_commit_sha;
  }
  if (pull.head?.sha && existingCommitsBySha[pull.head.sha]) {
    return pull.head.sha;
  }
  if (pull.merged_at) {
    const mergedEpoch = Date.parse(pull.merged_at);
    if (Number.isFinite(mergedEpoch)) {
      const found = defaultBranchEpoch.find((entry) => entry.epoch >= mergedEpoch);
      if (found) return found.sha;
    }
  }
  return null;
}

export function buildPrHistory(input: PrHistoryInput): PrHistoryResult {
  const branches: BranchLine[] = [];
  const commits: CommitNode[] = [];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  let capped = false;
  let fetchedPulls = 0;
  let fetchedPullCommits = 0;

  const themeTokens = THEMES["gitmetro-dark"];
  const defaultBranchEpoch = buildDefaultBranchEpochIndex(
    input.existingCommitsBySha,
    input.defaultBranchName,
  );

  const knownPullNumbers = new Set<number>();
  input.existingBranches.forEach((b) => {
    if (b.pullNumber) knownPullNumbers.add(b.pullNumber);
  });

  // Track shas added by this normalizer, so two PRs sharing a commit don't
  // duplicate the node.
  const addedShas = new Set<string>();

  let nextLane = input.startLane;
  let fallbackTBase: number | null = null;

  for (const pull of input.pulls) {
    if (branches.length >= input.prHistoryLimit) {
      capped = true;
      break;
    }
    if (knownPullNumbers.has(pull.number)) continue;

    const rawCommits = (input.commitsByPull[pull.number] ?? []).slice(
      0,
      input.prCommitLimit,
    );
    if (rawCommits.length === 0) continue;

    const newCommits = rawCommits.filter(
      (c) => !input.existingCommitsBySha[c.sha] && !addedShas.has(c.sha),
    );
    if (newCommits.length === 0) continue;

    const sortedCommits = [...newCommits].sort(
      (a, b) => pickEpoch(a) - pickEpoch(b),
    );

    const targetSha = pickTargetSha(
      pull,
      input.existingCommitsBySha,
      defaultBranchEpoch,
    );

    const targetT = targetSha
      ? input.existingCommitsBySha[targetSha].t
      : null;

    let baseT: number;
    if (targetT != null) {
      baseT = targetT - sortedCommits.length;
    } else {
      // Place after the existing graph, sequentially across PRs.
      if (fallbackTBase == null) {
        const maxT = Object.values(input.existingCommitsBySha).reduce(
          (acc, c) => Math.max(acc, c.t),
          -1,
        );
        fallbackTBase = maxT + 2;
      }
      baseT = fallbackTBase;
      fallbackTBase += sortedCommits.length + 1;
    }

    const branchId = `pr/${pull.number}`;
    const branchName = pull.head?.ref || `PR #${pull.number}`;
    const category = classifyBranchName(branchName);

    branches.push({
      id: branchId,
      name: branchName,
      category,
      color: colorForCategory(themeTokens, category),
      lane: nextLane--,
      headSha: pull.head?.sha,
      isHistorical: true,
      isActive: true,
      source: "pull-request",
      pullNumber: pull.number,
      pullTitle: pull.title,
      pullUrl: pull.html_url,
    });

    sortedCommits.forEach((raw, idx) => {
      const author = pickAuthorName(raw);
      commits.push({
        sha: raw.sha,
        shortSha: raw.sha.slice(0, 7),
        branch: branchId,
        t: baseT + idx,
        parents: raw.parents.map((p) => p.sha),
        message: firstLine(raw.commit.message),
        author,
        avatar: pickAvatar(author),
        date: formatDate(raw.commit.author?.date ?? raw.commit.committer?.date),
        files: undefined,
        isMerge: raw.parents.length > 1,
        pr: `#${pull.number}`,
      });
      addedShas.add(raw.sha);
    });

    fetchedPulls += 1;
    fetchedPullCommits += sortedCommits.length;

    if (targetSha) {
      const lastSha = sortedCommits[sortedCommits.length - 1].sha;
      edges.push({
        id: `pr-edge/${pull.number}`,
        from: lastSha,
        to: targetSha,
        type: "synthetic-pr",
        branchId,
      });
    } else {
      warnings.push(
        `PR #${pull.number}: could not connect to default branch (target commit not in graph)`,
      );
    }
  }

  if (capped) {
    warnings.push(
      `Showing ${branches.length} PR branches (capped by prHistoryLimit)`,
    );
  }

  return {
    branches,
    commits,
    edges,
    warnings,
    capped,
    fetchedPulls,
    fetchedPullCommits,
  };
}
