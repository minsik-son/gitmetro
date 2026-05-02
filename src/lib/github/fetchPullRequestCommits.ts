import { githubFetch } from "./client";
import type { GitHubCommitListItem } from "./types";

const PER_PAGE = 100;

export interface FetchPullRequestCommitsOptions {
  limit: number;
}

export async function fetchPullRequestCommits(
  owner: string,
  repo: string,
  pullNumber: number,
  options: FetchPullRequestCommitsOptions,
): Promise<GitHubCommitListItem[]> {
  const limit = Math.max(0, options.limit);
  if (limit === 0) return [];
  const collected: GitHubCommitListItem[] = [];
  let page = 1;
  while (collected.length < limit) {
    const remaining = limit - collected.length;
    const perPage = Math.min(PER_PAGE, remaining);
    const path =
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/` +
      `${pullNumber}/commits?per_page=${perPage}&page=${page}`;
    const { data } = await githubFetch<GitHubCommitListItem[]>(path);
    if (!Array.isArray(data) || data.length === 0) break;
    collected.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  return collected.slice(0, limit);
}
