import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_RETURN_TO_COOKIE,
  AUTH_STATE_COOKIE,
  getBaseUrl,
  getGithubOAuthConfig,
  sanitizeReturnTo,
} from "@/lib/auth/config";
import { authCookieOptions, parseCookieHeader } from "@/lib/auth/cookies";
import { safeEqual } from "@/lib/auth/crypto";
import { exchangeGitHubCode, fetchGitHubUser } from "@/lib/auth/githubOAuth";
import { encodeSession } from "@/lib/auth/session";
import type { GitMetroSession } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

function errorRedirect(req: Request, code: string): NextResponse {
  const url = new URL(`/?auth_error=${encodeURIComponent(code)}`, getBaseUrl(req));
  const res = NextResponse.redirect(url);
  // Always clear pending state cookies when bouncing on error.
  res.cookies.delete(AUTH_STATE_COOKIE);
  res.cookies.delete(AUTH_RETURN_TO_COOKIE);
  return res;
}

export async function GET(req: Request) {
  const config = getGithubOAuthConfig();
  if (!config.ok) {
    return errorRedirect(req, "oauth_not_configured");
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const queryState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return errorRedirect(req, oauthError);
  }

  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const expectedState = cookies.get(AUTH_STATE_COOKIE);
  const returnTo = sanitizeReturnTo(cookies.get(AUTH_RETURN_TO_COOKIE) ?? "/");

  if (
    !code ||
    !queryState ||
    !expectedState ||
    !safeEqual(queryState, expectedState)
  ) {
    return errorRedirect(req, "invalid_oauth_state");
  }

  const tokenResponse = await exchangeGitHubCode({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    code,
  });
  if (!tokenResponse.access_token) {
    return errorRedirect(req, tokenResponse.error ?? "github_oauth_failed");
  }

  let user;
  try {
    user = await fetchGitHubUser(tokenResponse.access_token);
  } catch {
    return errorRedirect(req, "github_user_fetch_failed");
  }

  const session: GitMetroSession = {
    provider: "github",
    accessToken: tokenResponse.access_token,
    tokenType: "bearer",
    scope: tokenResponse.scope ?? "",
    login: user.login,
    avatarUrl: user.avatar_url,
    name: user.name ?? null,
    createdAt: Date.now(),
  };

  const sessionToken = encodeSession(session);

  const res = NextResponse.redirect(new URL(returnTo, getBaseUrl(req)));
  res.cookies.set(AUTH_COOKIE, sessionToken, authCookieOptions(AUTH_COOKIE_MAX_AGE_SECONDS));
  res.cookies.delete(AUTH_STATE_COOKIE);
  res.cookies.delete(AUTH_RETURN_TO_COOKIE);
  return res;
}
