"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingTerminal } from "@/components/loading/LoadingTerminal";
import { MapShell } from "./MapShell";
import { GitHubGraphError } from "./GitHubGraphError";
import type {
  GraphApiFailure,
  GraphApiResponse,
  GraphMeta,
} from "@/lib/github/api-types";
import type { GitMetroGraph } from "@/types/gitmetro";

interface Props {
  owner: string;
  repo: string;
}

type State =
  | { status: "loading" }
  | { status: "success"; graph: GitMetroGraph; meta: GraphMeta }
  | { status: "error"; error: GraphApiFailure["error"] };

export function GitHubGraphLoader({ owner, repo }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    const url =
      `/api/github/graph?owner=${encodeURIComponent(owner)}` +
      `&repo=${encodeURIComponent(repo)}`;

    fetch(url)
      .then(async (res) => {
        const body = (await res.json()) as GraphApiResponse;
        if (cancelled) return;
        if (body.ok) {
          setState({ status: "success", graph: body.graph, meta: body.meta });
        } else {
          setState({ status: "error", error: body.error });
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({
          status: "error",
          error: {
            code: "github_unavailable",
            message: err.message,
            status: 0,
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [owner, repo, attempt]);

  if (state.status === "loading") {
    return <LoadingTerminal repoLabel={`${owner}/${repo}`} />;
  }

  if (state.status === "error") {
    return (
      <GitHubGraphError
        error={state.error}
        owner={owner}
        repo={repo}
        onRetry={retry}
      />
    );
  }

  return (
    <MapShell
      graph={state.graph}
      skipInitialLoading
      truncated={state.meta.truncated}
    />
  );
}
