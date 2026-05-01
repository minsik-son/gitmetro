import { GitHubApiError, describeStatus } from "./errors";
import type { RateLimitMeta } from "./types";

const DEFAULT_API_VERSION = "2022-11-28";
const BASE_URL = "https://api.github.com";

export interface GithubFetchResult<T> {
  data: T;
  rateLimit: RateLimitMeta;
  response: Response;
}

function readRateLimit(headers: Headers): RateLimitMeta {
  const toNum = (v: string | null) => (v == null ? undefined : Number(v));
  return {
    limit: toNum(headers.get("x-ratelimit-limit")),
    remaining: toNum(headers.get("x-ratelimit-remaining")),
    reset: toNum(headers.get("x-ratelimit-reset")),
  };
}

function buildHeaders(): HeadersInit {
  const apiVersion = process.env.GITHUB_API_VERSION || DEFAULT_API_VERSION;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": apiVersion,
    "User-Agent": "GitMetro",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) return `${BASE_URL}/${path}`;
  return `${BASE_URL}${path}`;
}

async function readBodyMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return "";
    try {
      const json = JSON.parse(text) as { message?: string };
      return json?.message ?? text;
    } catch {
      return text;
    }
  } catch {
    return "";
  }
}

function resetAtFromHeaders(headers: Headers): string | undefined {
  const reset = headers.get("x-ratelimit-reset");
  if (!reset) return undefined;
  const epoch = Number(reset);
  if (!Number.isFinite(epoch)) return undefined;
  return new Date(epoch * 1000).toISOString();
}

export async function githubFetch<T>(
  path: string,
): Promise<GithubFetchResult<T>> {
  const url = resolveUrl(path);
  let response: Response;
  try {
    response = await fetch(url, { headers: buildHeaders() });
  } catch (err) {
    throw new GitHubApiError({
      code: "github_unavailable",
      status: 0,
      message: `Network error contacting GitHub: ${(err as Error).message}`,
    });
  }

  if (response.ok) {
    let data: T;
    try {
      data = (await response.json()) as T;
    } catch (err) {
      throw new GitHubApiError({
        code: "unknown",
        status: response.status,
        message: `Invalid JSON from GitHub: ${(err as Error).message}`,
      });
    }
    return { data, rateLimit: readRateLimit(response.headers), response };
  }

  const message = (await readBodyMessage(response)) || describeStatus(response.status);

  if (response.status === 404) {
    throw new GitHubApiError({
      code: "not_found",
      status: 404,
      message,
    });
  }
  if (response.status === 403 || response.status === 429) {
    const remaining = Number(response.headers.get("x-ratelimit-remaining"));
    const isRate = response.status === 429 || remaining === 0;
    throw new GitHubApiError({
      code: isRate ? "rate_limited" : "forbidden",
      status: response.status,
      message,
      resetAt: isRate ? resetAtFromHeaders(response.headers) : undefined,
    });
  }
  if (response.status === 409) {
    throw new GitHubApiError({
      code: response.status === 409 ? "github_unavailable" : "unknown",
      status: response.status,
      message,
    });
  }
  if (response.status >= 500) {
    throw new GitHubApiError({
      code: "github_unavailable",
      status: response.status,
      message,
    });
  }
  throw new GitHubApiError({
    code: "unknown",
    status: response.status,
    message,
  });
}
