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
import {
  makePrCommitNodeId,
  makePrEndNodeId,
  makePrStartNodeId,
} from "./visualNode";

export interface PrTimelineHistoryInput {
  pulls: GitHubPullRequestListItem[];
  commitsByPull: Record<number, GitHubCommitListItem[]>;
  existingBranches: BranchLine[];
  existingCommits: CommitNode[];
  existingCommitsBySha: Record<string, CommitNode>;
  defaultBranchName: string;
  startLane: number;
  prHistoryLimit: number;
  prCommitLimit: number;
  /** Minimum visual span (in t units) between a PR's start and end node. */
  minPrVisualSpan: number;
}

export interface PrTimelineHistoryResult {
  branches: BranchLine[];
  commits: CommitNode[];
  edges: GraphEdge[];
  warnings: string[];
  capped: boolean;
  fetchedPulls: number;
  fetchedPullCommits: number;
  reconstructedBranches: number;
  virtualNodes: number;
  branchOffEdges: number;
  mergeBackEdges: number;
}

interface DefaultPoint {
  sha: string;
  nodeId: string;
  t: number;
  epoch: number;
}

function visualT(node: CommitNode): number {
  return node.displayT ?? node.t;
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

function dateEpoch(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function existingCommitDateEpoch(node: CommitNode): number {
  if (!node.date) return 0;
  // CommitNode.date is preformatted (YYYY-MM-DD HH:MM). Parse defensively.
  const iso = node.date.replace(" ", "T") + "Z";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function buildDefaultTimeline(
  existingCommits: CommitNode[],
  defaultBranchName: string,
): DefaultPoint[] {
  return existingCommits
    .filter((c) => c.branch === defaultBranchName)
    .map((c) => ({
      sha: c.sha,
      nodeId: c.nodeId ?? c.sha,
      t: visualT(c),
      epoch: existingCommitDateEpoch(c),
    }))
    .sort((a, b) => a.t - b.t);
}

function findDefaultBeforeEpoch(
  timeline: DefaultPoint[],
  epoch: number,
): DefaultPoint | null {
  let best: DefaultPoint | null = null;
  for (const point of timeline) {
    if (point.epoch <= epoch) {
      if (!best || point.epoch > best.epoch) best = point;
    }
  }
  return best;
}

function findDefaultAtOrAfterEpoch(
  timeline: DefaultPoint[],
  epoch: number,
): DefaultPoint | null {
  for (const point of timeline) {
    if (point.epoch >= epoch) return point;
  }
  return null;
}

function findDefaultByT(
  timeline: DefaultPoint[],
  predicate: (point: DefaultPoint) => boolean,
): DefaultPoint | null {
  for (const point of timeline) {
    if (predicate(point)) return point;
  }
  return null;
}

function pickBranchOffAnchor(
  pull: GitHubPullRequestListItem,
  rawCommits: GitHubCommitListItem[],
  existingCommitsBySha: Record<string, CommitNode>,
  timeline: DefaultPoint[],
): DefaultPoint | null {
  const firstRaw = rawCommits[0];
  if (firstRaw) {
    for (const parent of firstRaw.parents) {
      const node = existingCommitsBySha[parent.sha];
      if (node && node.branch === pull.base.ref) {
        const epoch = existingCommitDateEpoch(node);
        return {
          sha: node.sha,
          nodeId: node.nodeId ?? node.sha,
          t: visualT(node),
          epoch,
        };
      }
    }
  }

  const createdEpoch = dateEpoch(pull.created_at);
  if (createdEpoch != null) {
    const found = findDefaultBeforeEpoch(timeline, createdEpoch);
    if (found) return found;
  }

  if (firstRaw) {
    const firstCommitEpoch = pickEpoch(firstRaw);
    if (firstCommitEpoch > 0) {
      const found = findDefaultBeforeEpoch(timeline, firstCommitEpoch);
      if (found) return found;
    }
  }

  // Last resort: oldest default commit so that the PR still anchors somewhere.
  return timeline[0] ?? null;
}

function pickMergeBackAnchor(
  pull: GitHubPullRequestListItem,
  existingCommitsBySha: Record<string, CommitNode>,
  timeline: DefaultPoint[],
  branchOff: DefaultPoint,
): DefaultPoint | null {
  if (pull.merge_commit_sha) {
    const node = existingCommitsBySha[pull.merge_commit_sha];
    if (node) {
      return {
        sha: node.sha,
        nodeId: node.nodeId ?? node.sha,
        t: visualT(node),
        epoch: existingCommitDateEpoch(node),
      };
    }
  }
  if (pull.head?.sha) {
    const node = existingCommitsBySha[pull.head.sha];
    if (node && node.branch === pull.base.ref) {
      return {
        sha: node.sha,
        nodeId: node.nodeId ?? node.sha,
        t: visualT(node),
        epoch: existingCommitDateEpoch(node),
      };
    }
  }
  const mergedEpoch = dateEpoch(pull.merged_at);
  if (mergedEpoch != null) {
    const found = findDefaultAtOrAfterEpoch(timeline, mergedEpoch);
    if (found) return found;
  }
  const updatedEpoch = dateEpoch(pull.updated_at);
  if (updatedEpoch != null) {
    const found = findDefaultAtOrAfterEpoch(timeline, updatedEpoch);
    if (found) return found;
  }
  const fallback = findDefaultByT(timeline, (p) => p.t > branchOff.t);
  if (fallback) return fallback;
  return null;
}

interface CommitSlot {
  raw: GitHubCommitListItem;
  visualT: number;
}

function distributeCommitSlots(
  rawCommits: GitHubCommitListItem[],
  visualStartT: number,
  visualEndT: number,
): CommitSlot[] {
  if (rawCommits.length === 0) return [];
  const span = visualEndT - visualStartT;
  if (rawCommits.length === 1) {
    return [
      {
        raw: rawCommits[0],
        visualT: visualStartT + span / 2,
      },
    ];
  }
  const step = span / (rawCommits.length + 1);
  return rawCommits.map((raw, idx) => ({
    raw,
    visualT: visualStartT + step * (idx + 1),
  }));
}

export function buildPrTimelineHistory(
  input: PrTimelineHistoryInput,
): PrTimelineHistoryResult {
  const branches: BranchLine[] = [];
  const commits: CommitNode[] = [];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  const themeTokens = THEMES["gitmetro-dark"];

  const timeline = buildDefaultTimeline(
    input.existingCommits,
    input.defaultBranchName,
  );

  const knownPullNumbers = new Set<number>();
  input.existingBranches.forEach((b) => {
    if (b.pullNumber) knownPullNumbers.add(b.pullNumber);
  });

  let nextLane = input.startLane;
  let capped = false;
  let fetchedPulls = 0;
  let fetchedPullCommits = 0;
  let reconstructedBranches = 0;
  let virtualNodes = 0;
  let branchOffEdges = 0;
  let mergeBackEdges = 0;

  const minSpan = Math.max(0.5, input.minPrVisualSpan);

  for (const pull of input.pulls) {
    if (branches.length >= input.prHistoryLimit) {
      capped = true;
      break;
    }
    if (knownPullNumbers.has(pull.number)) continue;

    const rawAll = input.commitsByPull[pull.number] ?? [];
    if (rawAll.length === 0) continue;

    const seen = new Set<string>();
    const dedupedRaw: GitHubCommitListItem[] = [];
    rawAll.forEach((c) => {
      if (seen.has(c.sha)) return;
      seen.add(c.sha);
      dedupedRaw.push(c);
    });
    const rawCommits = dedupedRaw
      .slice()
      .sort((a, b) => pickEpoch(a) - pickEpoch(b))
      .slice(0, input.prCommitLimit);
    if (rawCommits.length === 0) continue;

    const branchOff = pickBranchOffAnchor(
      pull,
      rawCommits,
      input.existingCommitsBySha,
      timeline,
    );
    if (!branchOff) {
      warnings.push(
        `PR #${pull.number}: no branch-off anchor in default branch — skipped`,
      );
      continue;
    }

    const mergeBack = pickMergeBackAnchor(
      pull,
      input.existingCommitsBySha,
      timeline,
      branchOff,
    );

    const anchorStartT = branchOff.t;
    const anchorEndT =
      mergeBack?.t ?? anchorStartT + minSpan + rawCommits.length;

    const visualStartT = anchorStartT + 0.35;
    const visualEndT = Math.max(
      anchorEndT - 0.35,
      visualStartT + minSpan,
    );

    const slots = distributeCommitSlots(rawCommits, visualStartT, visualEndT);

    const branchId = `pr/${pull.number}`;
    const branchName = pull.head?.ref || `PR #${pull.number}`;
    const category = classifyBranchName(branchName);
    const lane = nextLane--;

    branches.push({
      id: branchId,
      name: branchName,
      category,
      color: colorForCategory(themeTokens, category),
      lane,
      headSha: pull.head?.sha,
      isHistorical: true,
      isActive: true,
      source: "pull-request",
      pullNumber: pull.number,
      pullTitle: pull.title,
      pullUrl: pull.html_url,
    });

    const startNodeId = makePrStartNodeId(pull.number);
    const endNodeId = makePrEndNodeId(pull.number);

    const startNode: CommitNode = {
      sha: startNodeId,
      shortSha: "open",
      branch: branchId,
      t: visualStartT,
      displayT: visualStartT,
      parents: [branchOff.nodeId],
      message: `PR #${pull.number} opened`,
      author: pull.user?.login ?? "github",
      avatar: pickAvatar(pull.user?.login ?? "PR"),
      date: formatDate(pull.created_at),
      isMerge: false,
      isVirtual: true,
      visualKind: "pr-start",
      nodeId: startNodeId,
      pr: `#${pull.number}`,
    };
    commits.push(startNode);
    virtualNodes += 1;

    edges.push({
      id: `pr-off/${pull.number}`,
      from: branchOff.nodeId,
      to: startNodeId,
      type: "pr-branch-off",
      branchId,
    });
    branchOffEdges += 1;

    let prevNodeId = startNodeId;
    slots.forEach((slot) => {
      const author = pickAuthorName(slot.raw);
      const nodeId = makePrCommitNodeId(pull.number, slot.raw.sha);
      const visualNode: CommitNode = {
        sha: slot.raw.sha,
        nodeId,
        realSha: slot.raw.sha,
        shortSha: slot.raw.sha.slice(0, 7),
        branch: branchId,
        t: slot.visualT,
        displayT: slot.visualT,
        parents: [prevNodeId],
        message: firstLine(slot.raw.commit.message),
        author,
        avatar: pickAvatar(author),
        date: formatDate(
          slot.raw.commit.author?.date ?? slot.raw.commit.committer?.date,
        ),
        isMerge: slot.raw.parents.length > 1,
        visualKind: "commit",
        pr: `#${pull.number}`,
      };
      commits.push(visualNode);
      edges.push({
        id: `pr-chain/${pull.number}/${nodeId}`,
        from: prevNodeId,
        to: nodeId,
        type: "pr-chain",
        branchId,
      });
      prevNodeId = nodeId;
    });

    const endNode: CommitNode = {
      sha: endNodeId,
      shortSha: "merge",
      branch: branchId,
      t: visualEndT,
      displayT: visualEndT,
      parents: [prevNodeId],
      message: `PR #${pull.number} merged`,
      author: pull.user?.login ?? "github",
      avatar: pickAvatar(pull.user?.login ?? "PR"),
      date: formatDate(pull.merged_at ?? pull.updated_at),
      isMerge: true,
      isVirtual: true,
      visualKind: "pr-end",
      nodeId: endNodeId,
      pr: `#${pull.number}`,
    };
    commits.push(endNode);
    virtualNodes += 1;

    edges.push({
      id: `pr-chain/${pull.number}/end`,
      from: prevNodeId,
      to: endNodeId,
      type: "pr-chain",
      branchId,
    });

    if (mergeBack) {
      edges.push({
        id: `pr-back/${pull.number}`,
        from: endNodeId,
        to: mergeBack.nodeId,
        type: "pr-merge-back",
        branchId,
      });
      mergeBackEdges += 1;
    } else {
      warnings.push(
        `PR #${pull.number}: no merge-back anchor (PR may not have landed in the visible window)`,
      );
    }

    fetchedPulls += 1;
    fetchedPullCommits += rawCommits.length;
    reconstructedBranches += 1;
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
    reconstructedBranches,
    virtualNodes,
    branchOffEdges,
    mergeBackEdges,
  };
}
