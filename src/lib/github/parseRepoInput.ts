export interface ParsedRepo {
  owner: string;
  repo: string;
}

export type ParseResult =
  | { ok: true; value: ParsedRepo }
  | { ok: false; error: string };

const SEGMENT = /^[A-Za-z0-9._-]+$/;

export function parseRepoInput(input: string): ParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter a GitHub repository." };

  let body = raw;
  body = body.replace(/^https?:\/\//i, "");
  body = body.replace(/^github\.com\//i, "");
  body = body.replace(/\.git$/i, "");
  body = body.replace(/\/+$/, "");

  const parts = body.split("/").filter(Boolean);
  if (parts.length < 2) {
    return { ok: false, error: "Use the format owner/repo." };
  }

  const [owner, repo] = parts;
  if (!SEGMENT.test(owner) || !SEGMENT.test(repo)) {
    return { ok: false, error: "Owner and repo can only contain letters, numbers, dots, dashes, underscores." };
  }

  return { ok: true, value: { owner, repo } };
}
