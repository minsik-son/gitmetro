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
  pullTitle?: string;
  pullUrl?: string;
}

export type GraphEdgeType =
  | "commit"
  | "branch"
  | "merge"
  | "synthetic-pr"
  | "pr-branch-off"
  | "pr-chain"
  | "pr-merge-back";

export interface GraphEdge {
  id: string;
  /** Visual node id or real sha. Renderer resolves via byNodeId then bySha. */
  from: string;
  /** Visual node id or real sha. Renderer resolves via byNodeId then bySha. */
  to: string;
  type: GraphEdgeType;
  branchId?: string;
  color?: string;
}

export type VisualNodeKind = "commit" | "pr-start" | "pr-end";

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

  /** Stable visual key. Required when the same real sha appears on multiple lanes. */
  nodeId?: string;
  /** Visual-only marker. Defaults to "commit" when omitted. */
  visualKind?: VisualNodeKind;
  /** True for synthetic PR start/end nodes generated from PR metadata. */
  isVirtual?: boolean;
  /** Original real sha when this visual node mirrors a real commit. */
  realSha?: string;
  /** Visual timeline override; takes precedence over `t` for layout. */
  displayT?: number;
}

export interface GitMetroGraph {
  repo: RepositorySummary;
  branches: BranchLine[];
  commits: CommitNode[];
  edges?: GraphEdge[];
}
