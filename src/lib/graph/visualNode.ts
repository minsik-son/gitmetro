import type { CommitNode } from "@/types/gitmetro";

export function getVisualNodeId(node: CommitNode): string {
  return node.nodeId ?? node.sha;
}

export function buildVisualNodeIndex(
  commits: CommitNode[],
): Record<string, CommitNode> {
  const byId: Record<string, CommitNode> = {};
  commits.forEach((commit) => {
    const id = getVisualNodeId(commit);
    if (id && !byId[id]) byId[id] = commit;
    if (commit.sha && !byId[commit.sha]) byId[commit.sha] = commit;
  });
  return byId;
}

export function makePrStartNodeId(pullNumber: number): string {
  return `virtual/pr/${pullNumber}/start`;
}

export function makePrEndNodeId(pullNumber: number): string {
  return `virtual/pr/${pullNumber}/end`;
}

export function makePrCommitNodeId(pullNumber: number, sha: string): string {
  return `pr/${pullNumber}/commit/${sha}`;
}
