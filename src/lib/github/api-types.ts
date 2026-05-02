import type { GitMetroGraph } from "@/types/gitmetro";
import type { GitHubErrorCode } from "./errors";

export interface GraphMeta {
  source: "github";
  owner: string;
  repo: string;
  truncated: boolean;
  selectedBranches: number;
  fetchedCommits: number;
  maxBranches: number;
  commitLimit: number;
  warnings: string[];
  history: {
    enabled: boolean;
    historicalBranches: number;
    capped: boolean;
    source: "first-parent-merge";
  };
  prHistory?: {
    enabled: boolean;
    branches: number;
    capped: boolean;
    fetchedPulls: number;
    fetchedPullCommits: number;
    mode?: "legacy" | "reconstructed";
    reconstructedBranches?: number;
    virtualNodes?: number;
    branchOffEdges?: number;
    mergeBackEdges?: number;
  };
  rateLimit?: {
    limit?: number;
    remaining?: number;
    reset?: number;
  };
  auth?: {
    authenticated: boolean;
    source: "oauth" | "env" | "none";
    login?: string;
  };
}

export interface GraphApiSuccess {
  ok: true;
  graph: GitMetroGraph;
  meta: GraphMeta;
}

export interface GraphApiFailure {
  ok: false;
  error: {
    code: GitHubErrorCode;
    message: string;
    status: number;
    resetAt?: string;
  };
}

export type GraphApiResponse = GraphApiSuccess | GraphApiFailure;
