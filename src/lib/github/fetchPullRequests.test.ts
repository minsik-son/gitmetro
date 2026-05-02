import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchMergedPullRequests } from "./fetchPullRequests";
import type { GitHubPullRequestListItem } from "./types";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function pr(overrides: Partial<GitHubPullRequestListItem> & { number: number }): GitHubPullRequestListItem {
  return {
    number: overrides.number,
    title: overrides.title ?? `PR ${overrides.number}`,
    state: overrides.state ?? "closed",
    merged_at:
      "merged_at" in overrides
        ? overrides.merged_at ?? null
        : "2026-04-01T00:00:00Z",
    merge_commit_sha:
      "merge_commit_sha" in overrides
        ? overrides.merge_commit_sha ?? null
        : `m${overrides.number}`,
    html_url: overrides.html_url ?? `https://github.com/o/r/pull/${overrides.number}`,
    head: overrides.head ?? {
      ref: `feature/${overrides.number}`,
      sha: `h${overrides.number}`,
    },
    base: overrides.base ?? { ref: "main", sha: "b" },
    user: overrides.user ?? { login: "alice" },
    updated_at: overrides.updated_at ?? "2026-04-02T00:00:00Z",
    created_at: overrides.created_at ?? "2026-03-30T00:00:00Z",
  };
}

describe("fetchMergedPullRequests", () => {
  it("hits the closed pulls endpoint with base + sort + direction", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([pr({ number: 1 })]));
    await fetchMergedPullRequests("octo", "cat", { base: "main", limit: 5 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/repos/octo/cat/pulls");
    expect(url).toContain("state=closed");
    expect(url).toContain("base=main");
    expect(url).toContain("sort=updated");
    expect(url).toContain("direction=desc");
  });

  it("filters out PRs without merged_at", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        pr({ number: 1 }),
        pr({ number: 2, merged_at: null }),
        pr({ number: 3 }),
      ]),
    );
    const out = await fetchMergedPullRequests("o", "r", {
      base: "main",
      limit: 10,
    });
    expect(out.map((p) => p.number)).toEqual([1, 3]);
  });

  it("stops once limit is reached without paging further", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(Array.from({ length: 100 }, (_, i) => pr({ number: i + 1 }))),
    );
    const out = await fetchMergedPullRequests("o", "r", {
      base: "main",
      limit: 4,
    });
    expect(out).toHaveLength(4);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("paginates up to maxPages until limit reached", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(
          Array.from({ length: 100 }, (_, i) =>
            pr({ number: i + 1, merged_at: i % 2 === 0 ? "2026-04-01T00:00:00Z" : null }),
          ),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          Array.from({ length: 100 }, (_, i) =>
            pr({ number: 100 + i + 1, merged_at: "2026-04-02T00:00:00Z" }),
          ),
        ),
      );
    const out = await fetchMergedPullRequests("o", "r", {
      base: "main",
      limit: 80,
      maxPages: 2,
    });
    expect(out).toHaveLength(80);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns empty list when limit is 0", async () => {
    const out = await fetchMergedPullRequests("o", "r", {
      base: "main",
      limit: 0,
    });
    expect(out).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("stops paging when an empty page is returned after a full page", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(
          Array.from({ length: 100 }, (_, i) => pr({ number: i + 1 })),
        ),
      )
      .mockResolvedValueOnce(jsonResponse([]));
    const out = await fetchMergedPullRequests("o", "r", {
      base: "main",
      limit: 200,
      maxPages: 5,
    });
    expect(out).toHaveLength(100);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
