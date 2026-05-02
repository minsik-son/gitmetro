import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "./route";
import {
  AUTH_COOKIE,
  AUTH_RETURN_TO_COOKIE,
  AUTH_STATE_COOKIE,
} from "@/lib/auth/config";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_SECRET", "callback-test-secret-with-enough-entropy-bbb");
  vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "client-id");
  vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "client-secret");
  vi.stubEnv(
    "GITHUB_OAUTH_REDIRECT_URI",
    "http://localhost:3000/api/auth/github/callback",
  );
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

function makeRequest(query: string, cookieHeader?: string): Request {
  const init: RequestInit = {};
  if (cookieHeader) init.headers = { cookie: cookieHeader };
  return new Request(
    `http://localhost/api/auth/github/callback?${query}`,
    init,
  );
}

describe("GET /api/auth/github/callback", () => {
  it("redirects with auth_error when state mismatches", async () => {
    const res = await GET(
      makeRequest("code=abc&state=mismatch", `${AUTH_STATE_COOKIE}=expected`),
    );
    expect(res.headers.get("location")).toContain(
      "auth_error=invalid_oauth_state",
    );
  });

  it("redirects with auth_error when code is missing", async () => {
    const res = await GET(
      makeRequest("state=expected", `${AUTH_STATE_COOKIE}=expected`),
    );
    expect(res.headers.get("location")).toContain(
      "auth_error=invalid_oauth_state",
    );
  });

  it("redirects with auth_error when GitHub returns oauth error in query", async () => {
    const res = await GET(
      makeRequest(
        "error=access_denied&error_description=user_denied",
        `${AUTH_STATE_COOKIE}=expected`,
      ),
    );
    expect(res.headers.get("location")).toContain("auth_error=access_denied");
  });

  it("redirects with auth_error when token exchange fails", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "bad_verification_code" }),
    );
    const res = await GET(
      makeRequest(
        "code=abc&state=expected",
        `${AUTH_STATE_COOKIE}=expected; ${AUTH_RETURN_TO_COOKIE}=%2F`,
      ),
    );
    expect(res.headers.get("location")).toContain(
      "auth_error=bad_verification_code",
    );
  });

  it("on success: sets encrypted session cookie, clears state cookies, redirects to returnTo", async () => {
    mockFetch
      // 1. token exchange
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "ghs_secret_token",
          token_type: "bearer",
          scope: "read:user",
        }),
      )
      // 2. /user fetch
      .mockResolvedValueOnce(
        jsonResponse({
          login: "octocat",
          avatar_url: "https://example.test/octocat.png",
          name: "Octocat",
        }),
      );

    const res = await GET(
      makeRequest(
        "code=abc&state=expected",
        `${AUTH_STATE_COOKIE}=expected; ${AUTH_RETURN_TO_COOKIE}=%2Fmap%2Ffoo%2Fbar`,
      ),
    );

    const location = res.headers.get("location") ?? "";
    expect(location.endsWith("/map/foo/bar")).toBe(true);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${AUTH_COOKIE}=`);
    // Plain access token must not leak into the cookie value as plaintext.
    expect(setCookie).not.toContain("ghs_secret_token");
    // Old state cookies are cleared.
    expect(setCookie).toContain(`${AUTH_STATE_COOKIE}=`);
    expect(setCookie).toContain(`${AUTH_RETURN_TO_COOKIE}=`);
  });
});
