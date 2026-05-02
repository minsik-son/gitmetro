export const AUTH_COOKIE = "gitmetro_session";
export const AUTH_STATE_COOKIE = "gitmetro_oauth_state";
export const AUTH_RETURN_TO_COOKIE = "gitmetro_auth_return_to";

export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

export const DEFAULT_OAUTH_SCOPE = "read:user";

export type GithubOAuthConfig =
  | {
      ok: true;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }
  | {
      ok: false;
      missing: string[];
    };

export function getGithubOAuthConfig(): GithubOAuthConfig {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  const missing: string[] = [];
  if (!clientId) missing.push("GITHUB_OAUTH_CLIENT_ID");
  if (!clientSecret) missing.push("GITHUB_OAUTH_CLIENT_SECRET");
  if (!redirectUri) missing.push("GITHUB_OAUTH_REDIRECT_URI");
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: redirectUri!,
  };
}

export function getBaseUrl(req: Request): string {
  const envRedirect = process.env.GITHUB_OAUTH_REDIRECT_URI;
  if (envRedirect) {
    try {
      return new URL(envRedirect).origin;
    } catch {
      // fall through
    }
  }
  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

/** Only allow returnTo paths that are local single-leading-slash absolute paths. */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}
