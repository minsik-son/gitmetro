import { THEMES, colorForCategory } from "@/lib/theme/themes";
import type {
  GitHubBranchListItem,
  GitHubCommitListItem,
  GitHubRepo,
  GitHubTagListItem,
} from "@/lib/github/types";
import type {
  BranchLine,
  CommitNode,
  GitMetroGraph,
  RepositorySummary,
} from "@/types/gitmetro";
import { selectBranches, type SelectedBranch } from "./branchSelection";
import { assignCommitBranches } from "./assignCommitBranches";
import { firstParentChain } from "./firstParentChain";
import { extractHistoricalBranches } from "./historicalBranches";

export interface NormalizeOptions {
  maxBranches: number;
  commitLimit: number;
  branchCommitLimit: number;
  includeHistory: boolean;
  historyLimit: number;
  historyCommitLimit: number;
}

export const DEFAULT_NORMALIZE_OPTIONS: NormalizeOptions = {
  maxBranches: 12,
  commitLimit: 500,
  branchCommitLimit: 80,
  includeHistory: true,
  historyLimit: 24,
  historyCommitLimit: 40,
};

export interface NormalizeInput {
  repo: GitHubRepo;
  branches: GitHubBranchListItem[];
  commitsByBranch: Record<string, GitHubCommitListItem[]>;
  tags: GitHubTagListItem[];
  options?: Partial<NormalizeOptions>;
}

export interface NormalizeResult {
  graph: GitMetroGraph;
  selectedBranches: SelectedBranch[];
  meta: {
    truncated: boolean;
    selectedBranches: number;
    fetchedCommits: number;
    maxBranches: number;
    commitLimit: number;
    warnings: string[];
    history: {
      enabled: boolean;
      historicalBranches: number;
      capped: boolean;
      source: "first-parent-merge";
    };
  };
}

function firstLine(message: string): string {
  const idx = message.indexOf("\n");
  return idx === -1 ? message : message.slice(0, idx);
}

function pickAuthorName(raw: GitHubCommitListItem): string {
  if (raw.author?.login) return raw.author.login;
  return (
    raw.commit.author?.name ?? raw.commit.committer?.name ?? "unknown"
  );
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

function pickDate(raw: GitHubCommitListItem): string {
  return formatDate(raw.commit.author?.date ?? raw.commit.committer?.date);
}

function pickEpoch(raw: GitHubCommitListItem): number {
  const candidate = raw.commit.author?.date ?? raw.commit.committer?.date;
  if (!candidate) return 0;
  const t = Date.parse(candidate);
  return Number.isFinite(t) ? t : 0;
}

function buildRepositorySummary(repo: GitHubRepo): RepositorySummary {
  return {
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description ?? undefined,
    defaultBranch: repo.default_branch,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    lastSync: formatDate(repo.pushed_at ?? repo.updated_at),
  };
}

export function normalizeGitHubGraph(input: NormalizeInput): NormalizeResult {
  const options: NormalizeOptions = {
    ...DEFAULT_NORMALIZE_OPTIONS,
    ...(input.options ?? {}),
  };
  const warnings: string[] = [];

  const selected = selectBranches({
    branches: input.branches,
    defaultBranch: input.repo.default_branch,
    maxBranches: options.maxBranches,
  });

  const truncatedBranches = selected.length < input.branches.length;

  // Limit each branch's commit list to branchCommitLimit before assignment.
  const cappedCommitsByBranch: Record<string, GitHubCommitListItem[]> = {};
  selected.forEach((b) => {
    const list = input.commitsByBranch[b.name] ?? [];
    cappedCommitsByBranch[b.name] = list.slice(0, options.branchCommitLimit);
  });

  // Build the raw commit pool keyed by sha.
  const rawBySha: Record<string, GitHubCommitListItem> = {};
  selected.forEach((b) => {
    cappedCommitsByBranch[b.name].forEach((c) => {
      if (!rawBySha[c.sha]) rawBySha[c.sha] = c;
    });
  });

  const defaultBranch = selected.find((b) => b.isDefault);
  const trunkSet =
    options.includeHistory && defaultBranch
      ? firstParentChain(rawBySha, defaultBranch.headSha)
      : null;

  const { primaryByCommit } = assignCommitBranches({
    selected,
    commitsByBranch: cappedCommitsByBranch,
    defaultBranchOnlyClaims: trunkSet ?? undefined,
  });

  // Extract historical branches from trunk merges only when history is on.
  const history =
    options.includeHistory && trunkSet
      ? extractHistoricalBranches({
          bySha: rawBySha,
          trunkSet,
          primaryByCommit,
          historyLimit: options.historyLimit,
          historyCommitLimit: options.historyCommitLimit,
        })
      : { branches: [], historicalAssignment: {}, capped: false, chainCapped: false };

  // Merge historical assignments into the primary map.
  Object.entries(history.historicalAssignment).forEach(([sha, branchId]) => {
    if (!primaryByCommit[sha]) primaryByCommit[sha] = branchId;
  });

  // Build tag map (sha -> tag name). Multiple tags on the same sha keep the
  // first one we see in the response.
  const tagBySha = new Map<string, string>();
  input.tags.forEach((t) => {
    if (!tagBySha.has(t.commit.sha)) {
      tagBySha.set(t.commit.sha, t.name);
    }
  });

  // Build BranchLine[]. Lane 0 for default; descending negative integers for
  // each subsequent ref branch in selection order. Historical branches stack
  // after all current refs.
  const defaultThemeColors = THEMES["gitmetro-dark"];
  const headByBranchSha = new Map<string, string>();
  selected.forEach((b) => headByBranchSha.set(b.headSha, b.name));

  let nextLane = -1;
  const refBranches: BranchLine[] = selected.map((b) => ({
    id: b.name,
    name: b.name,
    category: b.category,
    color: colorForCategory(defaultThemeColors, b.category),
    lane: b.isDefault ? 0 : nextLane--,
    headSha: b.headSha,
    isDefault: b.isDefault,
    isActive: true,
    source: "ref" as const,
  }));

  const historicalBranches: BranchLine[] = history.branches.map((b) => ({
    ...b,
    lane: nextLane--,
  }));

  const branches: BranchLine[] = [...refBranches, ...historicalBranches];

  // Sort included commits by date ascending; sha tie-break for stability.
  const includedRaw = Object.values(rawBySha)
    .filter((c) => primaryByCommit[c.sha])
    .sort((a, b) => {
      const ea = pickEpoch(a);
      const eb = pickEpoch(b);
      if (ea !== eb) return ea - eb;
      return a.sha.localeCompare(b.sha);
    });

  // Detect parents that are out of order (parent t > child t) — record but
  // don't reorder; layout will still draw a line, just possibly going right→left.
  const tBySha = new Map<string, number>();
  includedRaw.forEach((c, idx) => tBySha.set(c.sha, idx));

  const commits: CommitNode[] = includedRaw.map((raw, idx) => {
    const branchId = primaryByCommit[raw.sha];
    const author = pickAuthorName(raw);
    return {
      sha: raw.sha,
      shortSha: raw.sha.slice(0, 7),
      branch: branchId,
      t: idx,
      parents: raw.parents.map((p) => p.sha),
      message: firstLine(raw.commit.message),
      author,
      avatar: pickAvatar(author),
      date: pickDate(raw),
      files: undefined,
      isMerge: raw.parents.length > 1,
      isHead: headByBranchSha.has(raw.sha),
      isTag: tagBySha.has(raw.sha),
      tag: tagBySha.get(raw.sha),
    };
  });

  // Out-of-order parent detection
  let outOfOrder = 0;
  commits.forEach((c) => {
    c.parents.forEach((psha) => {
      const pt = tBySha.get(psha);
      if (pt != null && pt > c.t) outOfOrder++;
    });
  });
  if (outOfOrder > 0) {
    warnings.push(
      `${outOfOrder} parent edge(s) are out of date order; layout may show right-to-left segments`,
    );
  }

  if (truncatedBranches) {
    warnings.push(
      `Showing ${selected.length} of ${input.branches.length} branches (truncated by maxBranches)`,
    );
  }

  if (history.capped) {
    warnings.push(
      `Showing ${history.branches.length} historical merge branches (capped by historyLimit)`,
    );
  }
  if (history.chainCapped) {
    warnings.push(
      `Some historical branch chains hit historyCommitLimit and were truncated`,
    );
  }

  const totalRawCommits = Object.keys(rawBySha).length;
  if (commits.length > options.commitLimit) {
    commits.length = options.commitLimit;
    warnings.push(
      `Capped to ${options.commitLimit} commits (totalCommitLimit reached)`,
    );
  }

  const repoSummary = buildRepositorySummary(input.repo);
  const repoSummaryWithCounts: RepositorySummary = {
    ...repoSummary,
    commitsTotal: commits.length,
    branchesTotal: input.branches.length,
  };

  const graph: GitMetroGraph = {
    repo: repoSummaryWithCounts,
    branches,
    commits,
  };

  return {
    graph,
    selectedBranches: selected,
    meta: {
      truncated: truncatedBranches || commits.length < totalRawCommits,
      selectedBranches: selected.length,
      fetchedCommits: commits.length,
      maxBranches: options.maxBranches,
      commitLimit: options.commitLimit,
      warnings,
      history: {
        enabled: options.includeHistory,
        historicalBranches: history.branches.length,
        capped: history.capped,
        source: "first-parent-merge",
      },
    },
  };
}
