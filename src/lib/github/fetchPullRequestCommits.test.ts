import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchPullRequestCommits } from "./fetchPullRequestCommits";
import type { GitHubCommitListItem } from "./types";

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

function fakeCommit(n: number): GitHubCommitListItem {
  return {
    sha: `c${n}`,
    parents: [],
    commit: {
      message: `m${n}`,
      author: { name: "x", date: "2026-01-01T00:00:00Z" },
      committer: { name: "x", date: "2026-01-01T00:00:00Z" },
    },
    author: { login: "x" },
    html_url: "",
  };
}

describe("fetchPullRequestCommits", () => {
  it("hits /pulls/{n}/commits", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([fakeCommit(1)]));
    await fetchPullRequestCommits("o", "r", 42, { limit: 10 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/repos/o/r/pulls/42/commits");
  });

  it("paginates until limit reached", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(Array.from({ length: 100 }, (_, i) => fakeCommit(i))),
      )
      .mockResolvedValueOnce(
        jsonResponse(Array.from({ length: 50 }, (_, i) => fakeCommit(100 + i))),
      );
    const out = await fetchPullRequestCommits("o", "r", 1, { limit: 150 });
    expect(out).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("slices to limit when an over-large first page is returned", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(Array.from({ length: 100 }, (_, i) => fakeCommit(i))),
    );
    const out = await fetchPullRequestCommits("o", "r", 1, { limit: 40 });
    expect(out).toHaveLength(40);
  });

  it("returns empty when limit is 0", async () => {
    const out = await fetchPullRequestCommits("o", "r", 1, { limit: 0 });
    expect(out).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("stops paging on empty page", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse([fakeCommit(1)]))
      .mockResolvedValueOnce(jsonResponse([]));
    const out = await fetchPullRequestCommits("o", "r", 1, { limit: 200 });
    expect(out).toHaveLength(1);
  });
});
