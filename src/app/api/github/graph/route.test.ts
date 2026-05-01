import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import type { GraphApiResponse } from "@/lib/github/api-types";
import type {
  GitHubBranchListItem,
  GitHubCommitListItem,
  GitHubRepo,
  GitHubTagListItem,
} from "@/lib/github/types";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
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

function makeCommit(sha: string, date: string): GitHubCommitListItem {
  return {
    sha,
    parents: [],
    commit: {
      message: sha,
      author: { name: "x", date },
      committer: { name: "x", date },
    },
    author: { login: "x" },
    html_url: "",
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

    // Order of fetches inside the route:
    //  1. /repos/x/y                           -> repo
    //  2. /repos/x/y/branches?...              -> branches list
    //  3. /repos/x/y/commits?sha=main&...      -> main commits
    //  4. /repos/x/y/commits?sha=feature%2Fa   -> feature commits
    //  5. /repos/x/y/tags?...                  -> tags
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
      .mockResolvedValueOnce(jsonResponse(tags));

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
});
