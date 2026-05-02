import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "./route";
import { AUTH_COOKIE } from "@/lib/auth/config";
import { encodeSession } from "@/lib/auth/session";
import type { GitMetroSession } from "@/lib/auth/types";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_SECRET", "me-route-test-secret-with-enough-entropy-cccc");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/auth/github/me", () => {
  it("returns authenticated:false with no cookie", async () => {
    const res = await GET(new Request("http://localhost/api/auth/github/me"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authenticated: boolean };
    expect(body.authenticated).toBe(false);
  });

  it("returns the authenticated user without exposing the access token", async () => {
    const session: GitMetroSession = {
      provider: "github",
      accessToken: "ghs_super_secret_value",
      tokenType: "bearer",
      scope: "read:user",
      login: "octocat",
      avatarUrl: "https://example.test/octocat.png",
      name: "Octocat",
      createdAt: 1714530000000,
    };
    const cookieValue = encodeURIComponent(encodeSession(session));
    const req = new Request("http://localhost/api/auth/github/me", {
      headers: { cookie: `${AUTH_COOKIE}=${cookieValue}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      authenticated: boolean;
      user: { login: string; scope: string };
    };
    expect(body.authenticated).toBe(true);
    expect(body.user.login).toBe("octocat");
    expect(body.user.scope).toBe("read:user");
    const json = JSON.stringify(body);
    expect(json).not.toContain("ghs_super_secret_value");
  });

  it("returns authenticated:false on tampered cookie", async () => {
    const req = new Request("http://localhost/api/auth/github/me", {
      headers: { cookie: `${AUTH_COOKIE}=not-a-valid-token` },
    });
    const res = await GET(req);
    const body = (await res.json()) as { authenticated: boolean };
    expect(body.authenticated).toBe(false);
  });
});
