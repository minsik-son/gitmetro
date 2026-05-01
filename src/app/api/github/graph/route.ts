import { NextResponse } from "next/server";
import { fetchRepository } from "@/lib/github/fetchRepository";
import { fetchBranches } from "@/lib/github/fetchBranches";
import { fetchCommits } from "@/lib/github/fetchCommits";
import { fetchTags } from "@/lib/github/fetchTags";
import { GitHubApiError } from "@/lib/github/errors";
import { selectBranches } from "@/lib/graph/branchSelection";
import {
  DEFAULT_NORMALIZE_OPTIONS,
  normalizeGitHubGraph,
} from "@/lib/graph/normalizeGitHubGraph";
import { parseRepoInput } from "@/lib/github/parseRepoInput";
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
};

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

function failureResponse(failure: GraphApiFailure, status?: number) {
  return NextResponse.json(failure, { status: status ?? failure.error.status ?? 500 });
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

  const options = {
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
  };

  try {
    const repoResult = await fetchRepository(parsed.value.owner, parsed.value.repo);
    const lastRateLimit: RateLimitMeta = repoResult.rateLimit;

    const branchList = await fetchBranches(parsed.value.owner, parsed.value.repo);
    if (branchList.length === 0) {
      return failureResponse(
        {
          ok: false,
          error: {
            code: "empty_graph",
            message: "Repository has no branches.",
            status: 409,
          },
        },
        409,
      );
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
      const list = await fetchCommits(
        parsed.value.owner,
        parsed.value.repo,
        branch.name,
        {
          limit: Math.min(options.branchCommitLimit, remainingTotal),
        },
      );
      commitsByBranch[branch.name] = list;
      totalFetched += list.length;
    }

    const tagResult = await fetchTags(parsed.value.owner, parsed.value.repo);

    const normalize = normalizeGitHubGraph({
      repo: repoResult.repo,
      branches: branchList,
      commitsByBranch,
      tags: tagResult.tags,
      options,
    });

    if (normalize.graph.commits.length === 0) {
      return failureResponse(
        {
          ok: false,
          error: {
            code: "empty_graph",
            message: "No commits found for selected branches.",
            status: 409,
          },
        },
        409,
      );
    }

    const warnings = [...normalize.meta.warnings];
    if (tagResult.warning) warnings.push(tagResult.warning);

    const success: GraphApiSuccess = {
      ok: true,
      graph: normalize.graph,
      meta: {
        source: "github",
        owner: parsed.value.owner,
        repo: parsed.value.repo,
        truncated: normalize.meta.truncated,
        selectedBranches: normalize.meta.selectedBranches,
        fetchedCommits: normalize.meta.fetchedCommits,
        maxBranches: options.maxBranches,
        commitLimit: options.commitLimit,
        warnings,
        rateLimit: lastRateLimit,
      },
    };

    return NextResponse.json(success);
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
