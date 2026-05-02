import { githubFetch, type GithubFetchOptions } from "./client";
import type { GitHubCommitListItem } from "./types";

const PER_PAGE = 100;

export interface FetchCommitsOptions extends GithubFetchOptions {
  limit: number;
}

export async function fetchCommits(
  owner: string,
  repo: string,
  branchName: string,
  options: FetchCommitsOptions,
): Promise<GitHubCommitListItem[]> {
  const limit = Math.max(1, options.limit);
  const fetchOpts: GithubFetchOptions = { token: options.token };
  const collected: GitHubCommitListItem[] = [];
  let page = 1;
  while (collected.length < limit) {
    const remaining = limit - collected.length;
    const perPage = Math.min(PER_PAGE, remaining);
    const path =
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits` +
      `?sha=${encodeURIComponent(branchName)}` +
      `&per_page=${perPage}&page=${page}`;
    const { data } = await githubFetch<GitHubCommitListItem[]>(path, fetchOpts);
    if (!Array.isArray(data) || data.length === 0) break;
    collected.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  return collected.slice(0, limit);
}
