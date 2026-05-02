"use client";

import { useEffect, useState } from "react";
import { GhIcon } from "@/components/ui/icons";
import type { AuthUser } from "@/lib/auth/types";

interface MeResponse {
  ok: boolean;
  authenticated: boolean;
  user: AuthUser | null;
}

type State =
  | { status: "loading" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous" };

export function AuthStatus() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const fetchFn =
      typeof fetch === "function" ? fetch : null;
    if (!fetchFn) {
      setState({ status: "anonymous" });
      return;
    }
    Promise.resolve()
      .then(() => fetchFn("/api/auth/github/me"))
      .then((res) => res.json() as Promise<MeResponse>)
      .then((body) => {
        if (cancelled) return;
        if (body.authenticated && body.user) {
          setState({ status: "authenticated", user: body.user });
        } else {
          setState({ status: "anonymous" });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "anonymous" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <span
        data-testid="auth-status-loading"
        className="font-mono text-[10px] text-muted"
      >
        …
      </span>
    );
  }

  if (state.status === "authenticated") {
    const { user } = state;
    return (
      <span
        data-testid="auth-status-authenticated"
        className="inline-flex items-center gap-2 rounded-md border border-line bg-panel-alt px-2 py-1 text-xs text-text"
      >
        {user.avatarUrl ? (
          // Plain <img> is fine here — small avatar from GitHub CDN.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            width={16}
            height={16}
            className="rounded-full"
          />
        ) : (
          <GhIcon />
        )}
        <span className="font-mono">{user.login}</span>
        <a
          href="/api/auth/github/logout"
          data-testid="auth-logout-link"
          className="text-muted transition hover:text-text"
        >
          logout
        </a>
      </span>
    );
  }

  return (
    <a
      href="/api/auth/github/login"
      data-testid="auth-status-anonymous"
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-alt px-2.5 py-1 text-xs text-muted transition hover:text-text"
    >
      <GhIcon /> Sign in
    </a>
  );
}
