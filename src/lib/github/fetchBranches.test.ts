import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchBranches } from "./fetchBranches";
import type { GitHubBranchListItem } from "./types";

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

function fakeBranch(n: number): GitHubBranchListItem {
  return { name: `b${n}`, commit: { sha: `s${n}` } };
}

describe("fetchBranches", () => {
  it("requests page=1 with per_page=100 by default", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([fakeBranch(1)]));
    await fetchBranches("o", "r");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/repos/o/r/branches");
    expect(url).toContain("per_page=100");
    expect(url).toContain("page=1");
  });

  it("stops paging when a partial page is returned", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        Array.from({ length: 100 }, (_, i) => fakeBranch(i)),
      ),
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        Array.from({ length: 30 }, (_, i) => fakeBranch(100 + i)),
      ),
    );
    const result = await fetchBranches("o", "r");
    expect(result.length).toBe(130);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("stops paging when an empty page is returned", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([fakeBranch(1)]));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    const result = await fetchBranches("o", "r");
    expect(result).toHaveLength(1);
  });

  it("respects a custom maxPages", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(Array.from({ length: 100 }, (_, i) => fakeBranch(i))),
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse(Array.from({ length: 100 }, (_, i) => fakeBranch(100 + i))),
    );
    const result = await fetchBranches("o", "r", { maxPages: 2 });
    expect(result.length).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
