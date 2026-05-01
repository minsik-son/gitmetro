export type GitHubErrorCode =
  | "invalid_request"
  | "not_found"
  | "forbidden"
  | "rate_limited"
  | "github_unavailable"
  | "empty_graph"
  | "unknown";

export interface GitHubApiErrorOptions {
  code: GitHubErrorCode;
  status: number;
  message: string;
  resetAt?: string;
}

export class GitHubApiError extends Error {
  readonly code: GitHubErrorCode;
  readonly status: number;
  readonly resetAt?: string;

  constructor(opts: GitHubApiErrorOptions) {
    super(opts.message);
    this.name = "GitHubApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.resetAt = opts.resetAt;
  }
}

const STATUS_TEXT: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  422: "Unprocessable",
  500: "Server error",
  502: "Bad gateway",
  503: "Service unavailable",
};

export function describeStatus(status: number): string {
  return STATUS_TEXT[status] ?? `HTTP ${status}`;
}
