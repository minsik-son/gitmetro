import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  decodeSession,
  encodeSession,
  readSessionFromRequest,
  sessionToUser,
} from "./session";
import { AUTH_COOKIE } from "./config";
import type { GitMetroSession } from "./types";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_SECRET", "session-test-secret-with-enough-entropy-1234");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const session: GitMetroSession = {
  provider: "github",
  accessToken: "ghs_secret_token_value",
  tokenType: "bearer",
  scope: "read:user",
  login: "octocat",
  avatarUrl: "https://example.test/octocat.png",
  name: "Octocat",
  createdAt: 1714530000000,
};

describe("encodeSession / decodeSession", () => {
  it("round-trips a session", () => {
    const token = encodeSession(session);
    expect(token).not.toContain(session.accessToken);
    expect(decodeSession(token)).toEqual(session);
  });

  it("returns null on invalid token", () => {
    expect(decodeSession("not-valid")).toBeNull();
  });
});

describe("readSessionFromRequest", () => {
  it("returns null when no cookie header is present", () => {
    const req = new Request("http://localhost/api/x");
    expect(readSessionFromRequest(req)).toBeNull();
  });

  it("returns null when the auth cookie is missing", () => {
    const req = new Request("http://localhost/api/x", {
      headers: { cookie: "other=1; another=2" },
    });
    expect(readSessionFromRequest(req)).toBeNull();
  });

  it("returns the session when the auth cookie carries a valid token", () => {
    const token = encodeSession(session);
    const req = new Request("http://localhost/api/x", {
      headers: { cookie: `${AUTH_COOKIE}=${encodeURIComponent(token)}` },
    });
    expect(readSessionFromRequest(req)).toEqual(session);
  });

  it("returns null on an invalid cookie value", () => {
    const req = new Request("http://localhost/api/x", {
      headers: { cookie: `${AUTH_COOKIE}=not-a-real-token` },
    });
    expect(readSessionFromRequest(req)).toBeNull();
  });
});

describe("sessionToUser", () => {
  it("does not expose the access token", () => {
    const user = sessionToUser(session);
    expect(user).toEqual({
      provider: "github",
      login: "octocat",
      avatarUrl: "https://example.test/octocat.png",
      name: "Octocat",
      scope: "read:user",
    });
    const json = JSON.stringify(user);
    expect(json).not.toContain(session.accessToken);
  });
});
