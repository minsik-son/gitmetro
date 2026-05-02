import { NextResponse } from "next/server";
import { fetchRepository } from "@/lib/github/fetchRepository";
import { fetchBranches } from "@/lib/github/fetchBranches";
import { fetchCommits } from "@/lib/github/fetchCommits";
import { fetchTags } from "@/lib/github/fetchTags";
import { fetchMergedPullRequests } from "@/lib/github/fetchPullRequests";
import { fetchPullRequestCommits } from "@/lib/github/fetchPullRequestCommits";
import { GitHubApiError } from "@/lib/github/errors";
import { selectBranches } from "@/lib/graph/branchSelection";
import {
  DEFAULT_NORMALIZE_OPTIONS,
  normalizeGitHubGraph,
} from "@/lib/graph/normalizeGitHubGraph";
import { buildPrHistory } from "@/lib/graph/prHistory";
import { buildPrTimelineHistory } from "@/lib/graph/prTimelineReconstruction";
import { parseRepoInput } from "@/lib/github/parseRepoInput";
import {
  GRAPH_CACHE_TTL_MS,
  PR_CACHE_TTL_MS,
  getOrSetCached,
} from "@/lib/cache/memoryCache";
import { readSessionFromRequest } from "@/lib/auth/session";
import type { GitMetroSession } from "@/lib/auth/types";
import type {
  GitHubCommitListItem,
  RateLimitMeta,
} from "@/lib/github/types";
import type {
  GraphApiFailure,
  GraphApiSuccess,
} from "@/lib/github/api-types";

export const dynamic = "force-dynamic";

const CLAMP = {
  maxBranches: { min: 1, max: 30 },
  branchCommitLimit: { min: 10, max: 200 },
  commitLimit: { min: 50, max: 1000 },
  historyLimit: { min: 0, max: 50 },
  historyCommitLimit: { min: 5, max: 100 },
  prHistoryLimit: { min: 0, max: 50 },
  prCommitLimit: { min: 1, max: 100 },
  prListPages: { min: 1, max: 5 },
  minPrVisualSpan: { min: 1, max: 8 },
};

const DEFAULT_PR_HISTORY_LIMIT = 24;
const DEFAULT_PR_COMMIT_LIMIT = 40;
const DEFAULT_PR_LIST_PAGES = 2;
const DEFAULT_INCLUDE_PR_HISTORY = true;
const DEFAULT_MIN_PR_VISUAL_SPAN = 2;
const DEFAULT_PR_TIMELINE_MODE: PrTimelineMode = "reconstructed";

type PrTimelineMode = "reconstructed" | "legacy";

function readPrTimelineMode(url: URL): PrTimelineMode {
  const raw = url.searchParams.get("prTimelineMode");
  if (raw === "legacy" || raw === "reconstructed") return raw;
  return DEFAULT_PR_TIMELINE_MODE;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readNumber(
  url: URL,
  key: string,
  fallback: number,
  range: { min: number; max: number },
): number {
  const raw = url.searchParams.get(key);
  if (raw == null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.floor(n), range.min, range.max);
}

function readBoolean(url: URL, key: string, fallback: boolean): boolean {
  const raw = url.searchParams.get(key);
  if (raw == null) return fallback;
  if (raw === "false" || raw === "0" || raw === "off") return false;
  if (raw === "true" || raw === "1" || raw === "on") return true;
  return fallback;
}

function failureResponse(failure: GraphApiFailure, status?: number) {
  return NextResponse.json(failure, { status: status ?? failure.error.status ?? 500 });
}

function authScopeFor(session: GitMetroSession | null): string {
  if (session) return `oauth:${session.login}`;
  if (process.env.GITHUB_TOKEN) return "env";
  return "none";
}

function authMetaFor(
  session: GitMetroSession | null,
): NonNullable<GraphApiSuccess["meta"]["auth"]> {
  if (session) {
    return { authenticated: true, source: "oauth", login: session.login };
  }
  if (process.env.GITHUB_TOKEN) {
    return { authenticated: false, source: "env" };
  }
  return { authenticated: false, source: "none" };
}

function buildGraphCacheKey(
  owner: string,
  repo: string,
  o: GraphRouteOptions,
  authScope: string,
): string {
  return [
    "github-graph",
    `${owner}/${repo}`,
    `maxBranches=${o.maxBranches}`,
    `commitLimit=${o.commitLimit}`,
    `branchCommitLimit=${o.branchCommitLimit}`,
    `includeHistory=${o.includeHistory}`,
    `historyLimit=${o.historyLimit}`,
    `historyCommitLimit=${o.historyCommitLimit}`,
    `includePrHistory=${o.includePrHistory}`,
    `prHistoryLimit=${o.prHistoryLimit}`,
    `prCommitLimit=${o.prCommitLimit}`,
    `prListPages=${o.prListPages}`,
    `prTimelineMode=${o.prTimelineMode}`,
    `minPrVisualSpan=${o.minPrVisualSpan}`,
    `auth=${authScope}`,
  ].join(":");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner") ?? "";
  const repo = url.searchParams.get("repo") ?? "";

  const parsed = parseRepoInput(`${owner}/${repo}`);
  if (!parsed.ok) {
    return failureResponse(
      {
        ok: false,
        error: {
          code: "invalid_request",
          message: parsed.error,
          status: 400,
        },
      },
      400,
    );
  }

  const options: GraphRouteOptions = {
    maxBranches: readNumber(
      url,
      "maxBranches",
      DEFAULT_NORMALIZE_OPTIONS.maxBranches,
      CLAMP.maxBranches,
    ),
    branchCommitLimit: readNumber(
      url,
      "branchCommitLimit",
      DEFAULT_NORMALIZE_OPTIONS.branchCommitLimit,
      CLAMP.branchCommitLimit,
    ),
    commitLimit: readNumber(
      url,
      "commitLimit",
      DEFAULT_NORMALIZE_OPTIONS.commitLimit,
      CLAMP.commitLimit,
    ),
    includeHistory: readBoolean(
      url,
      "includeHistory",
      DEFAULT_NORMALIZE_OPTIONS.includeHistory,
    ),
    historyLimit: readNumber(
      url,
      "historyLimit",
      DEFAULT_NORMALIZE_OPTIONS.historyLimit,
      CLAMP.historyLimit,
    ),
    historyCommitLimit: readNumber(
      url,
      "historyCommitLimit",
      DEFAULT_NORMALIZE_OPTIONS.historyCommitLimit,
      CLAMP.historyCommitLimit,
    ),
    includePrHistory: readBoolean(
      url,
      "includePrHistory",
      DEFAULT_INCLUDE_PR_HISTORY,
    ),
    prHistoryLimit: readNumber(
      url,
      "prHistoryLimit",
      DEFAULT_PR_HISTORY_LIMIT,
      CLAMP.prHistoryLimit,
    ),
    prCommitLimit: readNumber(
      url,
      "prCommitLimit",
      DEFAULT_PR_COMMIT_LIMIT,
      CLAMP.prCommitLimit,
    ),
    prListPages: readNumber(
      url,
      "prListPages",
      DEFAULT_PR_LIST_PAGES,
      CLAMP.prListPages,
    ),
    prTimelineMode: readPrTimelineMode(url),
    minPrVisualSpan: readNumber(
      url,
      "minPrVisualSpan",
      DEFAULT_MIN_PR_VISUAL_SPAN,
      CLAMP.minPrVisualSpan,
    ),
  };

  const session = readSessionFromRequest(req);
  const authScope = authScopeFor(session);
  const cacheKey = buildGraphCacheKey(
    parsed.value.owner,
    parsed.value.repo,
    options,
    authScope,
  );

  try {
    const result = await getOrSetCached(cacheKey, GRAPH_CACHE_TTL_MS, () =>
      buildGraphResponse(parsed.value.owner, parsed.value.repo, options, session),
    );
    if (!result.ok) {
      return failureResponse(result.failure, result.failure.error.status);
    }
    return NextResponse.json(result.success);
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return failureResponse({
        ok: false,
        error: {
          code: err.code,
          message: err.message,
          status: err.status || 500,
          resetAt: err.resetAt,
        },
      });
    }
    return failureResponse(
      {
        ok: false,
        error: {
          code: "unknown",
          message: (err as Error).message,
          status: 500,
        },
      },
      500,
    );
  }
}

interface GraphRouteOptions {
  maxBranches: number;
  branchCommitLimit: number;
  commitLimit: number;
  includeHistory: boolean;
  historyLimit: number;
  historyCommitLimit: number;
  includePrHistory: boolean;
  prHistoryLimit: number;
  prCommitLimit: number;
  prListPages: number;
  prTimelineMode: PrTimelineMode;
  minPrVisualSpan: number;
}

type BuildGraphResult =
  | { ok: true; success: GraphApiSuccess }
  | { ok: false; failure: GraphApiFailure };

async function buildGraphResponse(
  owner: string,
  repo: string,
  options: GraphRouteOptions,
  session: GitMetroSession | null,
): Promise<BuildGraphResult> {
  const token = session?.accessToken ?? null;
  const repoResult = await fetchRepository(owner, repo, { token });
  const lastRateLimit: RateLimitMeta = repoResult.rateLimit;

  const branchList = await fetchBranches(owner, repo, { token });
  if (branchList.length === 0) {
    return {
      ok: false,
      failure: {
        ok: false,
        error: {
          code: "empty_graph",
          message: "Repository has no branches.",
          status: 409,
        },
      },
    };
  }

  const selected = selectBranches({
    branches: branchList,
    defaultBranch: repoResult.repo.default_branch,
    maxBranches: options.maxBranches,
  });

  const commitsByBranch: Record<string, GitHubCommitListItem[]> = {};
  let totalFetched = 0;
  for (const branch of selected) {
    if (totalFetched >= options.commitLimit) {
      commitsByBranch[branch.name] = [];
      continue;
    }
    const remainingTotal = options.commitLimit - totalFetched;
    const list = await fetchCommits(owner, repo, branch.name, {
      limit: Math.min(options.branchCommitLimit, remainingTotal),
      token,
    });
    commitsByBranch[branch.name] = list;
    totalFetched += list.length;
  }

  const tagResult = await fetchTags(owner, repo, { token });

  const normalize = normalizeGitHubGraph({
    repo: repoResult.repo,
    branches: branchList,
    commitsByBranch,
    tags: tagResult.tags,
    options,
  });

  if (normalize.graph.commits.length === 0) {
    return {
      ok: false,
      failure: {
        ok: false,
        error: {
          code: "empty_graph",
          message: "No commits found for selected branches.",
          status: 409,
        },
      },
    };
  }

  const warnings = [...normalize.meta.warnings];
  if (tagResult.warning) warnings.push(tagResult.warning);

  // PR enrichment: best-effort, never fails the whole request.
  let prMeta: GraphApiSuccess["meta"]["prHistory"] | undefined;
  if (options.includePrHistory && options.prHistoryLimit > 0) {
    try {
      const prList = await getOrSetCached(
        `github-pr-list:${owner}/${repo}:base=${repoResult.repo.default_branch}:limit=${options.prHistoryLimit}:pages=${options.prListPages}:auth=${session ? `oauth:${session.login}` : process.env.GITHUB_TOKEN ? "env" : "none"}`,
        PR_CACHE_TTL_MS,
        () =>
          fetchMergedPullRequests(owner, repo, {
            base: repoResult.repo.default_branch,
            limit: options.prHistoryLimit,
            maxPages: options.prListPages,
            token,
          }),
      );

      const commitsByPull: Record<number, GitHubCommitListItem[]> = {};
      for (const pull of prList) {
        try {
          const prCommits = await getOrSetCached(
            `github-pr-commits:${owner}/${repo}:pull=${pull.number}:limit=${options.prCommitLimit}:auth=${session ? `oauth:${session.login}` : process.env.GITHUB_TOKEN ? "env" : "none"}`,
            PR_CACHE_TTL_MS,
            () =>
              fetchPullRequestCommits(owner, repo, pull.number, {
                limit: options.prCommitLimit,
                token,
              }),
          );
          commitsByPull[pull.number] = prCommits;
        } catch (err) {
          warnings.push(
            `PR #${pull.number}: commits fetch failed (${describeFetchError(err)})`,
          );
        }
      }

      const existingCommitsBySha: Record<string, (typeof normalize.graph.commits)[number]> = {};
      normalize.graph.commits.forEach((c) => {
        existingCommitsBySha[c.sha] = c;
      });

      const minLane = normalize.graph.branches.reduce(
        (acc, b) => Math.min(acc, b.lane),
        0,
      );

      if (options.prTimelineMode === "reconstructed") {
        const pr = buildPrTimelineHistory({
          pulls: prList,
          commitsByPull,
          existingBranches: normalize.graph.branches,
          existingCommits: normalize.graph.commits,
          existingCommitsBySha,
          defaultBranchName: repoResult.repo.default_branch,
          startLane: minLane - 1,
          prHistoryLimit: options.prHistoryLimit,
          prCommitLimit: options.prCommitLimit,
          minPrVisualSpan: options.minPrVisualSpan,
        });

        normalize.graph.branches.push(...pr.branches);
        normalize.graph.commits.push(...pr.commits);
        if (pr.edges.length > 0) {
          normalize.graph.edges = [...(normalize.graph.edges ?? []), ...pr.edges];
        }
        pr.warnings.forEach((w) => warnings.push(w));

        prMeta = {
          enabled: true,
          branches: pr.branches.length,
          capped: pr.capped,
          fetchedPulls: pr.fetchedPulls,
          fetchedPullCommits: pr.fetchedPullCommits,
          mode: "reconstructed",
          reconstructedBranches: pr.reconstructedBranches,
          virtualNodes: pr.virtualNodes,
          branchOffEdges: pr.branchOffEdges,
          mergeBackEdges: pr.mergeBackEdges,
        };
      } else {
        const pr = buildPrHistory({
          pulls: prList,
          commitsByPull,
          existingBranches: normalize.graph.branches,
          existingCommitsBySha,
          defaultBranchName: repoResult.repo.default_branch,
          startLane: minLane - 1,
          prHistoryLimit: options.prHistoryLimit,
          prCommitLimit: options.prCommitLimit,
        });

        normalize.graph.branches.push(...pr.branches);
        normalize.graph.commits.push(...pr.commits);
        if (pr.edges.length > 0) {
          normalize.graph.edges = [...(normalize.graph.edges ?? []), ...pr.edges];
        }
        pr.warnings.forEach((w) => warnings.push(w));

        prMeta = {
          enabled: true,
          branches: pr.branches.length,
          capped: pr.capped,
          fetchedPulls: pr.fetchedPulls,
          fetchedPullCommits: pr.fetchedPullCommits,
          mode: "legacy",
        };
      }

      if (
        prList.length === 0 &&
        normalize.meta.history.historicalBranches === 0
      ) {
        warnings.push(
          "No merged PRs found via the GitHub PR API; the repository may use a non-standard merge flow.",
        );
      }
    } catch (err) {
      warnings.push(
        `PR enrichment skipped (${describeFetchError(err)}); showing branch graph only.`,
      );
      prMeta = {
        enabled: true,
        branches: 0,
        capped: false,
        fetchedPulls: 0,
        fetchedPullCommits: 0,
        mode: options.prTimelineMode,
      };
    }
  } else {
    prMeta = {
      enabled: false,
      branches: 0,
      capped: false,
      fetchedPulls: 0,
      fetchedPullCommits: 0,
      mode: options.prTimelineMode,
    };
  }

  const success: GraphApiSuccess = {
    ok: true,
    graph: normalize.graph,
    meta: {
      source: "github",
      owner,
      repo,
      truncated: normalize.meta.truncated,
      selectedBranches: normalize.meta.selectedBranches,
      fetchedCommits: normalize.meta.fetchedCommits,
      maxBranches: options.maxBranches,
      commitLimit: options.commitLimit,
      warnings,
      history: normalize.meta.history,
      prHistory: prMeta,
      rateLimit: lastRateLimit,
      auth: authMetaFor(session),
    },
  };

  return { ok: true, success };
}

function describeFetchError(err: unknown): string {
  if (err instanceof GitHubApiError) return err.code;
  if (err instanceof Error) return err.message;
  return "unknown";
}
