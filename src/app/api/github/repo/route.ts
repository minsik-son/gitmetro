import { NextResponse } from "next/server";
import { fetchRepository } from "@/lib/github/fetchRepository";
import { GitHubApiError } from "@/lib/github/errors";
import { parseRepoInput } from "@/lib/github/parseRepoInput";
import { readSessionFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner") ?? "";
  const repo = url.searchParams.get("repo") ?? "";

  const parsed = parseRepoInput(`${owner}/${repo}`);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "invalid_request", message: parsed.error, status: 400 },
      },
      { status: 400 },
    );
  }

  const session = readSessionFromRequest(req);
  const token = session?.accessToken ?? null;

  try {
    const result = await fetchRepository(parsed.value.owner, parsed.value.repo, {
      token,
    });
    return NextResponse.json({ ok: true, repo: result.repo });
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: err.code,
            message: err.message,
            status: err.status,
            resetAt: err.resetAt,
          },
        },
        { status: err.status || 500 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "unknown",
          message: (err as Error).message,
          status: 500,
        },
      },
      { status: 500 },
    );
  }
}
