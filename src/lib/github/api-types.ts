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
  rateLimit?: {
    limit?: number;
    remaining?: number;
    reset?: number;
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
