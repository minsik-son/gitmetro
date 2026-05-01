import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { githubFetch } from "./client";
import { GitHubApiError } from "./errors";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.unstubAllEnvs();
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("githubFetch headers", () => {
  it("sends the standard Accept, X-GitHub-Api-Version, and User-Agent headers", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await githubFetch("/repos/foo/bar");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Accept")).toBe("application/vnd.github+json");
    expect(headers.get("X-GitHub-Api-Version")).toBeTruthy();
    expect(headers.get("User-Agent")).toBe("GitMetro");
  });

  it("does not send Authorization when GITHUB_TOKEN is missing", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await githubFetch("/repos/foo/bar");
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("sends Authorization: Bearer when GITHUB_TOKEN is present", async () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_abc123");
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await githubFetch("/repos/foo/bar");
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer ghp_abc123");
  });

  it("respects GITHUB_API_VERSION override", async () => {
    vi.stubEnv("GITHUB_API_VERSION", "2024-01-01");
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await githubFetch("/repos/foo/bar");
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("X-GitHub-Api-Version")).toBe("2024-01-01");
  });

  it("targets api.github.com when given a path-only argument", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await githubFetch("/repos/foo/bar");
    expect(mockFetch.mock.calls[0][0]).toBe("https://api.github.com/repos/foo/bar");
  });
});

describe("githubFetch success and rate limit meta", () => {
  it("returns parsed JSON and rate limit meta on 200", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        { name: "react" },
        {
          status: 200,
          headers: {
            "x-ratelimit-limit": "60",
            "x-ratelimit-remaining": "57",
            "x-ratelimit-reset": "1893456000",
          },
        },
      ),
    );
    const result = await githubFetch<{ name: string }>("/repos/foo/bar");
    expect(result.data).toEqual({ name: "react" });
    expect(result.rateLimit).toEqual({
      limit: 60,
      remaining: 57,
      reset: 1893456000,
    });
  });
});

describe("githubFetch error mapping", () => {
  it("throws not_found on 404", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ message: "Not Found" }, { status: 404 }),
    );
    await expect(githubFetch("/repos/foo/bar")).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });
  });

  it("throws rate_limited on 403 with remaining=0", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        { message: "API rate limit exceeded" },
        {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "1893456000",
          },
        },
      ),
    );
    try {
      await githubFetch("/repos/foo/bar");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(GitHubApiError);
      const e = err as GitHubApiError;
      expect(e.code).toBe("rate_limited");
      expect(e.status).toBe(403);
      expect(e.resetAt).toBe(new Date(1893456000 * 1000).toISOString());
    }
  });

  it("throws forbidden on 403 with remaining > 0", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        { message: "Forbidden" },
        { status: 403, headers: { "x-ratelimit-remaining": "5" } },
      ),
    );
    await expect(githubFetch("/repos/foo/bar")).rejects.toMatchObject({
      code: "forbidden",
      status: 403,
    });
  });

  it("throws github_unavailable on 5xx", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ message: "Server error" }, { status: 502 }),
    );
    await expect(githubFetch("/repos/foo/bar")).rejects.toMatchObject({
      code: "github_unavailable",
      status: 502,
    });
  });

  it("wraps network errors as github_unavailable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(githubFetch("/repos/foo/bar")).rejects.toMatchObject({
      code: "github_unavailable",
      status: 0,
    });
  });

  it("wraps invalid JSON on 200 as unknown", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(githubFetch("/repos/foo/bar")).rejects.toMatchObject({
      code: "unknown",
    });
  });
});
