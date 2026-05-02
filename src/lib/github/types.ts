export interface GitHubRepo {
  owner: { login: string };
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string | null;
  updated_at: string | null;
  private: boolean;
  html_url: string;
}

export interface GitHubBranchListItem {
  name: string;
  commit: { sha: string };
  protected?: boolean;
}

export interface GitHubCommitAuthor {
  name?: string;
  email?: string;
  date?: string;
}

export interface GitHubCommitListItem {
  sha: string;
  parents: { sha: string }[];
  commit: {
    message: string;
    author: GitHubCommitAuthor | null;
    committer: GitHubCommitAuthor | null;
  };
  author: { login?: string; avatar_url?: string } | null;
  html_url: string;
}

export interface GitHubTagListItem {
  name: string;
  commit: { sha: string };
}

export interface RateLimitMeta {
  limit?: number;
  remaining?: number;
  reset?: number;
}

export interface GitHubPullRequestListItem {
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  merge_commit_sha: string | null;
  html_url: string;
  head: {
    ref: string;
    sha: string;
    label?: string;
    repo?: { full_name: string } | null;
    user?: { login: string } | null;
  };
  base: {
    ref: string;
    sha: string;
  };
  user?: {
    login?: string;
    avatar_url?: string;
  } | null;
  updated_at: string;
  created_at: string;
}
