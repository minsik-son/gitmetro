import { NextResponse } from "next/server";
import {
  AUTH_RETURN_TO_COOKIE,
  AUTH_STATE_COOKIE,
  DEFAULT_OAUTH_SCOPE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  getBaseUrl,
  getGithubOAuthConfig,
  sanitizeReturnTo,
} from "@/lib/auth/config";
import { authCookieOptions } from "@/lib/auth/cookies";
import { createRandomState } from "@/lib/auth/crypto";
import { buildGitHubAuthorizeUrl } from "@/lib/auth/githubOAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const config = getGithubOAuthConfig();
  if (!config.ok) {
    const url = new URL("/?auth_error=oauth_not_configured", getBaseUrl(req));
    return NextResponse.redirect(url);
  }

  const reqUrl = new URL(req.url);
  const returnTo = sanitizeReturnTo(reqUrl.searchParams.get("returnTo"));
  const state = createRandomState();

  const authorizeUrl = buildGitHubAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
    scope: DEFAULT_OAUTH_SCOPE,
  });

  const res = NextResponse.redirect(authorizeUrl);
  const stateOptions = authCookieOptions(OAUTH_STATE_MAX_AGE_SECONDS);
  res.cookies.set(AUTH_STATE_COOKIE, state, stateOptions);
  res.cookies.set(AUTH_RETURN_TO_COOKIE, returnTo, stateOptions);
  return res;
}
