import { DEFAULT_OAUTH_SCOPE } from "./config";
import type {
  GitHubOAuthTokenResponse,
  GitHubUserResponse,
} from "./types";

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

export interface BuildAuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}

export function buildGitHubAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", input.scope ?? DEFAULT_OAUTH_SCOPE);
  url.searchParams.set("allow_signup", "true");
  return url.toString();
}

export interface ExchangeCodeInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}

export async function exchangeGitHubCode(
  input: ExchangeCodeInput,
): Promise<GitHubOAuthTokenResponse> {
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "GitMetro",
      },
      body: JSON.stringify({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        code: input.code,
        redirect_uri: input.redirectUri,
      }),
    });
  } catch (err) {
    return {
      error: "network_error",
      error_description: (err as Error).message,
    };
  }
  if (!res.ok) {
    return { error: `http_${res.status}` };
  }
  try {
    return (await res.json()) as GitHubOAuthTokenResponse;
  } catch (err) {
    return {
      error: "invalid_response",
      error_description: (err as Error).message,
    };
  }
}

export async function fetchGitHubUser(
  accessToken: string,
): Promise<GitHubUserResponse> {
  const res = await fetch(USER_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "GitMetro",
    },
  });
  if (!res.ok) {
    throw new Error(`github_user_fetch_failed_${res.status}`);
  }
  return (await res.json()) as GitHubUserResponse;
}
