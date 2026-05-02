import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { clearCacheForTests } from "@/lib/cache/memoryCache";
import type { GraphApiResponse } from "@/lib/github/api-types";
import type {
  GitHubBranchListItem,
  GitHubCommitListItem,
  GitHubPullRequestListItem,
  GitHubRepo,
  GitHubTagListItem,
} from "@/lib/github/types";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  clearCacheForTests();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCacheForTests();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

function makeRepo(): GitHubRepo {
  return {
    owner: { login: "x" },
    name: "y",
    full_name: "x/y",
    description: null,
    default_branch: "main",
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    private: false,
    html_url: "https://github.com/x/y",
  };
}

function makeBranch(name: string, sha: string): GitHubBranchListItem {
  return { name, commit: { sha } };
}

function makeCommit(
  sha: string,
  date: string,
  parents: string[] = [],
): GitHubCommitListItem {
  return {
    sha,
    parents: parents.map((p) => ({ sha: p })),
    commit: {
      message: sha,
      author: { name: "x", date },
      committer: { name: "x", date },
    },
    author: { login: "x" },
    html_url: "",
  };
}

function makePr(
  overrides: Partial<GitHubPullRequestListItem> & { number: number },
): GitHubPullRequestListItem {
  return {
    number: overrides.number,
    title: overrides.title ?? `PR ${overrides.number}`,
    state: overrides.state ?? "closed",
    merged_at: overrides.merged_at ?? "2026-04-10T00:00:00Z",
    merge_commit_sha: overrides.merge_commit_sha ?? null,
    html_url:
      overrides.html_url ?? `https://github.com/x/y/pull/${overrides.number}`,
    head: overrides.head ?? {
      ref: `feature/${overrides.number}`,
      sha: `h${overrides.number}`,
    },
    base: overrides.base ?? { ref: "main", sha: "b" },
    user: overrides.user ?? { login: "alice" },
    updated_at: overrides.updated_at ?? "2026-04-10T01:00:00Z",
    created_at: overrides.created_at ?? "2026-04-09T00:00:00Z",
  };
}

function reqUrl(query: string): Request {
  return new Request(`http://localhost/api/github/graph?${query}`);
}

describe("GET /api/github/graph", () => {
  it("returns 400 invalid_request when owner/repo missing", async () => {
    const res = await GET(reqUrl(""));
    expect(res.status).toBe(400);
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("invalid_request");
  });

  it("returns 404 not_found when GitHub repo lookup is 404", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ message: "Not Found" }, { status: 404 }),
    );
    const res = await GET(reqUrl("owner=x&repo=y"));
    expect(res.status).toBe(404);
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("not_found");
  });

  it("returns rate_limited error when GitHub returns 403 with remaining=0", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        { message: "API rate limit exceeded" },
        {
          status: 403,
          headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1893456000" },
        },
      ),
    );
    const res = await GET(reqUrl("owner=x&repo=y"));
    expect(res.status).toBe(403);
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(false);
    if (!body.ok) {
      expect(body.error.code).toBe("rate_limited");
      expect(body.error.resetAt).toBeTruthy();
    }
  });

  it("returns 200 success with normalized graph for a small synthetic repo", async () => {
    const repo = makeRepo();
    const branches: GitHubBranchListItem[] = [
      makeBranch("main", "m2"),
      makeBranch("feature/a", "f1"),
    ];
    const tags: GitHubTagListItem[] = [];

    mockFetch
      .mockResolvedValueOnce(jsonResponse(repo))
      .mockResolvedValueOnce(jsonResponse(branches))
      .mockResolvedValueOnce(
        jsonResponse([
          makeCommit("m2", "2026-04-05T09:00:00Z"),
          makeCommit("m1", "2026-04-01T09:00:00Z"),
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          makeCommit("f1", "2026-04-04T09:00:00Z"),
          makeCommit("m1", "2026-04-01T09:00:00Z"),
        ]),
      )
      .mockResolvedValueOnce(jsonResponse(tags))
      // PR list (empty)
      .mockResolvedValueOnce(jsonResponse([]));

    const res = await GET(reqUrl("owner=x&repo=y"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.graph.repo.fullName).toBe("x/y");
      expect(body.graph.branches.map((b) => b.id)).toEqual(["main", "feature/a"]);
      const shas = body.graph.commits.map((c) => c.sha).sort();
      expect(shas).toEqual(["f1", "m1", "m2"]);
      expect(body.meta.source).toBe("github");
    }
  });

  it("returns empty_graph 409 when the repo has no branches", async () => {
    const repo = makeRepo();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(repo))
      .mockResolvedValueOnce(jsonResponse([]));
    const res = await GET(reqUrl("owner=x&repo=y"));
    expect(res.status).toBe(409);
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.error.code).toBe("empty_graph");
  });

  it("returns history meta with enabled=true by default", async () => {
    const repo = makeRepo();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(repo))
      .mockResolvedValueOnce(jsonResponse([makeBranch("main", "m1")]))
      .mockResolvedValueOnce(jsonResponse([makeCommit("m1", "2026-04-01T00:00:00Z")]))
      .mockResolvedValueOnce(jsonResponse([]))
      // PR list (empty)
      .mockResolvedValueOnce(jsonResponse([]));
    const res = await GET(reqUrl("owner=x&repo=y"));
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.meta.history.enabled).toBe(true);
      expect(body.meta.history.source).toBe("first-parent-merge");
    }
  });

  it("disables history when includeHistory=false in the query", async () => {
    const repo = makeRepo();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(repo))
      .mockResolvedValueOnce(jsonResponse([makeBranch("main", "m1")]))
      .mockResolvedValueOnce(jsonResponse([makeCommit("m1", "2026-04-01T00:00:00Z")]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));
    const res = await GET(reqUrl("owner=x&repo=y&includeHistory=false"));
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.meta.history.enabled).toBe(false);
      expect(body.meta.history.historicalBranches).toBe(0);
    }
  });

  it("does not call PR endpoints when includePrHistory=false", async () => {
    const repo = makeRepo();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(repo))
      .mockResolvedValueOnce(jsonResponse([makeBranch("main", "m1")]))
      .mockResolvedValueOnce(jsonResponse([makeCommit("m1", "2026-04-01T00:00:00Z")]))
      .mockResolvedValueOnce(jsonResponse([]));
    const res = await GET(reqUrl("owner=x&repo=y&includePrHistory=false"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.meta.prHistory?.enabled).toBe(false);
    }
    // 4 calls: repo, branches, commits/main, tags. No PR list.
    expect(mockFetch).toHaveBeenCalledTimes(4);
    const lastUrl = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0] as string;
    expect(lastUrl).not.toContain("/pulls");
  });

  it("enriches the graph with reconstructed PR timeline by default", async () => {
    const repo = makeRepo();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(repo))
      .mockResolvedValueOnce(jsonResponse([makeBranch("main", "M2")]))
      .mockResolvedValueOnce(
        jsonResponse([
          makeCommit("M2", "2026-04-12T00:00:00Z"),
          makeCommit("M1", "2026-04-10T00:00:00Z"),
        ]),
      )
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse([
          makePr({
            number: 7,
            merge_commit_sha: "M2",
            head: { ref: "feature/wallet", sha: "h7" },
          }),
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          makeCommit("p7a", "2026-04-11T01:00:00Z", ["M1"]),
          makeCommit("p7b", "2026-04-11T02:00:00Z", ["p7a"]),
        ]),
      );

    const res = await GET(reqUrl("owner=x&repo=y"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.meta.prHistory?.mode).toBe("reconstructed");
      expect(body.meta.prHistory?.reconstructedBranches).toBe(1);
      expect(body.meta.prHistory?.virtualNodes).toBe(2);
      expect(body.meta.prHistory?.branchOffEdges).toBe(1);
      expect(body.meta.prHistory?.mergeBackEdges).toBe(1);

      const prBranch = body.graph.branches.find((b) => b.id === "pr/7");
      expect(prBranch?.source).toBe("pull-request");

      const prVirtualStart = body.graph.commits.find(
        (c) => c.nodeId === "virtual/pr/7/start",
      );
      const prVirtualEnd = body.graph.commits.find(
        (c) => c.nodeId === "virtual/pr/7/end",
      );
      expect(prVirtualStart?.isVirtual).toBe(true);
      expect(prVirtualEnd?.isVirtual).toBe(true);

      const types = (body.graph.edges ?? []).map((e) => e.type);
      expect(types).toContain("pr-branch-off");
      expect(types).toContain("pr-merge-back");
      expect(types).toContain("pr-chain");
    }
  });

  it("falls back to legacy PR enrichment when prTimelineMode=legacy", async () => {
    const repo = makeRepo();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(repo))
      .mockResolvedValueOnce(jsonResponse([makeBranch("main", "M2")]))
      .mockResolvedValueOnce(
        jsonResponse([
          makeCommit("M2", "2026-04-12T00:00:00Z"),
          makeCommit("M1", "2026-04-10T00:00:00Z"),
        ]),
      )
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse([
          makePr({
            number: 7,
            merge_commit_sha: "M2",
            head: { ref: "feature/wallet", sha: "h7" },
          }),
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          makeCommit("p7a", "2026-04-11T01:00:00Z", ["M1"]),
          makeCommit("p7b", "2026-04-11T02:00:00Z", ["p7a"]),
        ]),
      );

    const res = await GET(reqUrl("owner=x&repo=y&prTimelineMode=legacy"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.meta.prHistory?.mode).toBe("legacy");
      expect(body.meta.prHistory?.virtualNodes).toBeUndefined();

      const types = (body.graph.edges ?? []).map((e) => e.type);
      expect(types).toContain("synthetic-pr");
      expect(types).not.toContain("pr-branch-off");
    }
  });

  it("clamps minPrVisualSpan within 1..8 range", async () => {
    const repo = makeRepo();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(repo))
      .mockResolvedValueOnce(jsonResponse([makeBranch("main", "M2")]))
      .mockResolvedValueOnce(
        jsonResponse([
          makeCommit("M2", "2026-04-12T00:00:00Z"),
          makeCommit("M1", "2026-04-10T00:00:00Z"),
        ]),
      )
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse([
          makePr({
            number: 7,
            merge_commit_sha: "M2",
            head: { ref: "feature/wallet", sha: "h7" },
          }),
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([makeCommit("p7", "2026-04-11T01:00:00Z", ["M1"])]),
      );

    const res = await GET(
      reqUrl("owner=x&repo=y&minPrVisualSpan=999"),
    );
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(true);
    if (body.ok) {
      const start = body.graph.commits.find(
        (c) => c.nodeId === "virtual/pr/7/start",
      );
      const end = body.graph.commits.find(
        (c) => c.nodeId === "virtual/pr/7/end",
      );
      const span =
        (end!.displayT ?? end!.t) - (start!.displayT ?? start!.t);
      // Clamp upper bound is 8.
      expect(span).toBeLessThanOrEqual(8);
      expect(span).toBeGreaterThanOrEqual(1);
    }
  });

  it("treats PR list fetch failure as a warning, not a hard error", async () => {
    const repo = makeRepo();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(repo))
      .mockResolvedValueOnce(jsonResponse([makeBranch("main", "M1")]))
      .mockResolvedValueOnce(
        jsonResponse([makeCommit("M1", "2026-04-10T00:00:00Z")]),
      )
      .mockResolvedValueOnce(jsonResponse([]))
      // PR list fails with 503.
      .mockResolvedValueOnce(
        jsonResponse({ message: "service down" }, { status: 503 }),
      );

    const res = await GET(reqUrl("owner=x&repo=y"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as GraphApiResponse;
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.meta.warnings.some((w) => w.toLowerCase().includes("pr"))).toBe(true);
      expect(body.meta.prHistory?.enabled).toBe(true);
      expect(body.meta.prHistory?.branches).toBe(0);
    }
  });

  it("hits the in-memory cache on a second identical request", async () => {
    const repo = makeRepo();
    mockFetch
      .mockResolvedValueOnce(jsonResponse(repo))
      .mockResolvedValueOnce(jsonResponse([makeBranch("main", "M1")]))
      .mockResolvedValueOnce(
        jsonResponse([makeCommit("M1", "2026-04-10T00:00:00Z")]),
      )
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const res1 = await GET(reqUrl("owner=x&repo=y"));
    expect(res1.status).toBe(200);
    const callsAfterFirst = mockFetch.mock.calls.length;

    const res2 = await GET(reqUrl("owner=x&repo=y"));
    expect(res2.status).toBe(200);
    expect(mockFetch.mock.calls.length).toBe(callsAfterFirst);
  });
});
