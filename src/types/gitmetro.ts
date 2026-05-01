export type MapOrientation = "horizontal" | "vertical";

export type VisualMode = "metro" | "skill-tree";

export type ThemeKey = "gitmetro-dark" | "london-tube" | "cyberpunk" | "skill-tree";

export type BranchCategory =
  | "main"
  | "develop"
  | "feature"
  | "hotfix"
  | "release"
  | "other";

export interface RepositorySummary {
  owner: string;
  name: string;
  fullName: string;
  description?: string;
  defaultBranch: string;
  stars?: number;
  forks?: number;
  commitsTotal?: number;
  branchesTotal?: number;
  contributors?: number;
  lastSync?: string;
}

export type BranchSource = "ref" | "merge-history" | "pull-request";

export interface BranchLine {
  id: string;
  name: string;
  category: BranchCategory;
  color: string;
  lane: number;
  headSha?: string;
  isDefault?: boolean;
  isActive?: boolean;
  isHistorical?: boolean;
  source?: BranchSource;
  mergedIntoSha?: string;
  sourceSha?: string;
  pullNumber?: number;
}

export interface CommitNode {
  sha: string;
  shortSha: string;
  branch: string;
  t: number;
  parents: string[];
  message: string;
  author: string;
  avatar?: string;
  date: string;
  files?: number;
  isMerge: boolean;
  isHead?: boolean;
  isTag?: boolean;
  tag?: string;
  pr?: string;
}

export interface GitMetroGraph {
  repo: RepositorySummary;
  branches: BranchLine[];
  commits: CommitNode[];
}
