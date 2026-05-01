import { githubFetch } from "./client";
import type { GitHubBranchListItem } from "./types";

const PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 5;

export async function fetchBranches(
  owner: string,
  repo: string,
  options: { maxPages?: number } = {},
): Promise<GitHubBranchListItem[]> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const collected: GitHubBranchListItem[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const path =
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches` +
      `?per_page=${PER_PAGE}&page=${page}`;
    const { data } = await githubFetch<GitHubBranchListItem[]>(path);
    if (!Array.isArray(data) || data.length === 0) break;
    collected.push(...data);
    if (data.length < PER_PAGE) break;
  }
  return collected;
}
