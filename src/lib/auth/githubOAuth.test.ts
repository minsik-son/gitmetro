import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildGitHubAuthorizeUrl,
  exchangeGitHubCode,
  fetchGitHubUser,
} from "./githubOAuth";

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

describe("buildGitHubAuthorizeUrl", () => {
  it("includes client_id, redirect_uri, state, and default scope", () => {
    const url = buildGitHubAuthorizeUrl({
      clientId: "abc",
      redirectUri: "http://localhost:3000/api/auth/github/callback",
      state: "state-xyz",
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://github.com");
    expect(parsed.pathname).toBe("/login/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("abc");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/github/callback",
    );
    expect(parsed.searchParams.get("state")).toBe("state-xyz");
    expect(parsed.searchParams.get("scope")).toBe("read:user");
  });

  it("respects a custom scope", () => {
    const url = buildGitHubAuthorizeUrl({
      clientId: "abc",
      redirectUri: "http://x/cb",
      state: "s",
      scope: "read:user repo",
    });
    expect(new URL(url).searchParams.get("scope")).toBe("read:user repo");
  });
});

describe("exchangeGitHubCode", () => {
  it("POSTs JSON to the token endpoint and returns parsed body", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ access_token: "tok", scope: "read:user", token_type: "bearer" }),
    );
    const out = await exchangeGitHubCode({
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "http://x/cb",
      code: "the-code",
    });
    expect(out.access_token).toBe("tok");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as Record<string, string>;
    expect(body.client_id).toBe("id");
    expect(body.client_secret).toBe("secret");
    expect(body.code).toBe("the-code");
    expect(body.redirect_uri).toBe("http://x/cb");
  });

  it("maps non-OK HTTP responses to an error result", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("nope", { status: 502 }),
    );
    const out = await exchangeGitHubCode({
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "http://x/cb",
      code: "bad",
    });
    expect(out.error).toBe("http_502");
    expect(out.access_token).toBeUndefined();
  });

  it("captures network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const out = await exchangeGitHubCode({
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "http://x/cb",
      code: "x",
    });
    expect(out.error).toBe("network_error");
  });
});

describe("fetchGitHubUser", () => {
  it("sends Authorization: Bearer and returns the parsed user", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ login: "octocat", avatar_url: "u", name: "O" }),
    );
    const out = await fetchGitHubUser("token-1");
    expect(out.login).toBe("octocat");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/user");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(new Response("x", { status: 401 }));
    await expect(fetchGitHubUser("bad")).rejects.toThrow(/github_user_fetch_failed/);
  });
});
