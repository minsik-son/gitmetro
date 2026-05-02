import { githubFetch } from "./client";
import type { GitHubPullRequestListItem } from "./types";

const PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 2;

export interface FetchMergedPullRequestsOptions {
  base: string;
  limit: number;
  maxPages?: number;
}

export async function fetchMergedPullRequests(
  owner: string,
  repo: string,
  options: FetchMergedPullRequestsOptions,
): Promise<GitHubPullRequestListItem[]> {
  const limit = Math.max(0, options.limit);
  if (limit === 0) return [];
  const maxPages = Math.max(1, options.maxPages ?? DEFAULT_MAX_PAGES);
  const collected: GitHubPullRequestListItem[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const path =
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls` +
      `?state=closed&base=${encodeURIComponent(options.base)}` +
      `&sort=updated&direction=desc&per_page=${PER_PAGE}&page=${page}`;
    const { data } = await githubFetch<GitHubPullRequestListItem[]>(path);
    if (!Array.isArray(data) || data.length === 0) break;
    for (const pr of data) {
      if (pr.merged_at) {
        collected.push(pr);
        if (collected.length >= limit) return collected;
      }
    }
    if (data.length < PER_PAGE) break;
  }
  return collected.slice(0, limit);
}
