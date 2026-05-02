export interface GitMetroSession {
  provider: "github";
  accessToken: string;
  tokenType: "bearer";
  scope: string;
  login: string;
  avatarUrl?: string;
  name?: string | null;
  createdAt: number;
}

export interface GitHubOAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

export interface GitHubUserResponse {
  login: string;
  avatar_url?: string;
  name?: string | null;
}

export interface AuthUser {
  provider: "github";
  login: string;
  avatarUrl?: string;
  name?: string | null;
  scope: string;
}
