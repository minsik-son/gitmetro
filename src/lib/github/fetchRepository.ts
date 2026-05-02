import { githubFetch, type GithubFetchOptions } from "./client";
import type { GitHubRepo, RateLimitMeta } from "./types";

export interface RepositoryFetchResult {
  repo: GitHubRepo;
  rateLimit: RateLimitMeta;
}

export async function fetchRepository(
  owner: string,
  repo: string,
  options: GithubFetchOptions = {},
): Promise<RepositoryFetchResult> {
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const { data, rateLimit } = await githubFetch<GitHubRepo>(path, options);
  return { repo: data, rateLimit };
}
