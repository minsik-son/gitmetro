import { githubFetch } from "./client";
import { GitHubApiError } from "./errors";
import type { GitHubTagListItem } from "./types";

const PER_PAGE = 100;
const DEFAULT_MAX_PAGES = 3;

export interface TagsFetchResult {
  tags: GitHubTagListItem[];
  warning?: string;
}

export async function fetchTags(
  owner: string,
  repo: string,
  options: { maxPages?: number } = {},
): Promise<TagsFetchResult> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const collected: GitHubTagListItem[] = [];
  try {
    for (let page = 1; page <= maxPages; page++) {
      const path =
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags` +
        `?per_page=${PER_PAGE}&page=${page}`;
      const { data } = await githubFetch<GitHubTagListItem[]>(path);
      if (!Array.isArray(data) || data.length === 0) break;
      collected.push(...data);
      if (data.length < PER_PAGE) break;
    }
    return { tags: collected };
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return { tags: [], warning: `tags fetch failed: ${err.code}` };
    }
    return { tags: [], warning: `tags fetch failed: unknown error` };
  }
}
