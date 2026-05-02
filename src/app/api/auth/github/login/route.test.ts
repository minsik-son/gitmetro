import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "./route";
import {
  AUTH_RETURN_TO_COOKIE,
  AUTH_STATE_COOKIE,
} from "@/lib/auth/config";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_SECRET", "login-test-secret-with-enough-entropy-aaaa");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/auth/github/login", () => {
  it("redirects to '/?auth_error=oauth_not_configured' when env is missing", async () => {
    const res = await GET(new Request("http://localhost/api/auth/github/login"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const location = res.headers.get("location");
    expect(location).toBeTruthy();
    expect(location).toContain("auth_error=oauth_not_configured");
  });

  it("redirects to GitHub authorize URL with required params and sets state + returnTo cookies", async () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "test-client");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "test-secret");
    vi.stubEnv(
      "GITHUB_OAUTH_REDIRECT_URI",
      "http://localhost:3000/api/auth/github/callback",
    );

    const res = await GET(
      new Request("http://localhost/api/auth/github/login?returnTo=/map/x/y"),
    );
    const location = res.headers.get("location") ?? "";
    expect(location.startsWith("https://github.com/login/oauth/authorize")).toBe(true);
    const url = new URL(location);
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/github/callback",
    );
    expect(url.searchParams.get("scope")).toBe("read:user");
    expect(url.searchParams.get("state")).toBeTruthy();

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${AUTH_STATE_COOKIE}=`);
    expect(setCookie).toContain(`${AUTH_RETURN_TO_COOKIE}=`);
  });

  it("sanitizes returnTo to '/' for non-internal paths", async () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "x");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "x");
    vi.stubEnv(
      "GITHUB_OAUTH_REDIRECT_URI",
      "http://localhost:3000/api/auth/github/callback",
    );
    const res = await GET(
      new Request(
        "http://localhost/api/auth/github/login?returnTo=https://evil.example/",
      ),
    );
    const setCookie = res.headers.get("set-cookie") ?? "";
    // Cookie value comes after the cookie name; we only assert the safe '/' prefix.
    expect(setCookie).toMatch(new RegExp(`${AUTH_RETURN_TO_COOKIE}=%2F`));
  });
});
