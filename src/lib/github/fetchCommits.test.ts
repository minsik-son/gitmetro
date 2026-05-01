import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCommits } from "./fetchCommits";
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

describe("fetchCommits", () => {
  it("includes sha=branchName in the query", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([fakeCommit(1)]));
    await fetchCommits("o", "r", "feature/auth", { limit: 10 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("sha=feature%2Fauth");
    expect(url).toContain("/repos/o/r/commits");
  });

  it("paginates until limit is reached", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(Array.from({ length: 100 }, (_, i) => fakeCommit(i))),
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse(Array.from({ length: 50 }, (_, i) => fakeCommit(100 + i))),
    );
    const out = await fetchCommits("o", "r", "main", { limit: 150 });
    expect(out).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("slices to limit when an over-large page is returned", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(Array.from({ length: 100 }, (_, i) => fakeCommit(i))),
    );
    const out = await fetchCommits("o", "r", "main", { limit: 80 });
    expect(out).toHaveLength(80);
  });

  it("stops paging when an empty page is returned", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([fakeCommit(1)]));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    const out = await fetchCommits("o", "r", "main", { limit: 200 });
    expect(out).toHaveLength(1);
  });
});
