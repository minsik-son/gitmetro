import type { GitHubCommitListItem } from "@/lib/github/types";

/**
 * Walk first-parent links from `headSha` and return the set of commit shas
 * reachable along the trunk. Stops cleanly when the next first parent is
 * missing from `bySha` (typical when fetched commit limits cut history off)
 * or when a parent is encountered that's already been visited (defensive
 * cycle guard — git itself can't produce one, but `bySha` is untrusted input).
 */
export function firstParentChain(
  bySha: Record<string, GitHubCommitListItem>,
  headSha: string | undefined,
): Set<string> {
  const trunk = new Set<string>();
  if (!headSha) return trunk;

  let cursor: string | undefined = headSha;
  while (cursor && bySha[cursor] && !trunk.has(cursor)) {
    trunk.add(cursor);
    const next: string | undefined = bySha[cursor].parents[0]?.sha;
    cursor = next;
  }
  return trunk;
}
