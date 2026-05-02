import { AUTH_COOKIE } from "./config";
import { parseCookieHeader } from "./cookies";
import { decryptJson, encryptJson } from "./crypto";
import type { AuthUser, GitMetroSession } from "./types";

export function encodeSession(session: GitMetroSession): string {
  return encryptJson<GitMetroSession>(session);
}

export function decodeSession(value: string): GitMetroSession | null {
  return decryptJson<GitMetroSession>(value);
}

export function readSessionFromRequest(req: Request): GitMetroSession | null {
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const value = cookies.get(AUTH_COOKIE);
  if (!value) return null;
  return decodeSession(value);
}

export function sessionToUser(session: GitMetroSession): AuthUser {
  return {
    provider: "github",
    login: session.login,
    avatarUrl: session.avatarUrl,
    name: session.name ?? null,
    scope: session.scope,
  };
}
