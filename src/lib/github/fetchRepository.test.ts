import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchRepository } from "./fetchRepository";

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

describe("fetchRepository", () => {
  it("calls /repos/{owner}/{repo}", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        owner: { login: "facebook" },
        name: "react",
        full_name: "facebook/react",
        description: "A library",
        default_branch: "main",
        stargazers_count: 1,
        forks_count: 1,
        pushed_at: null,
        updated_at: null,
        private: false,
        html_url: "https://github.com/facebook/react",
      }),
    );
    const result = await fetchRepository("facebook", "react");
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/facebook/react",
    );
    expect(result.repo.full_name).toBe("facebook/react");
  });

  it("URL-encodes owner and repo segments", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        owner: { login: "x" },
        name: "y",
        full_name: "x/y",
        description: null,
        default_branch: "main",
        stargazers_count: 0,
        forks_count: 0,
        pushed_at: null,
        updated_at: null,
        private: false,
        html_url: "",
      }),
    );
    await fetchRepository("foo bar", "baz/qux");
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/foo%20bar/baz%2Fqux",
    );
  });
});
