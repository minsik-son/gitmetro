"use client";

import { useEffect, useState } from "react";
import { GhIcon } from "@/components/ui/icons";
import type { AuthUser } from "@/lib/auth/types";
import type { GraphMeta } from "@/lib/github/api-types";
import { AccountMenu } from "./AccountMenu";

interface MeResponse {
  ok: boolean;
  authenticated: boolean;
  user: AuthUser | null;
}

type State =
  | { status: "loading" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous" };

export type AuthStatusVariant = "toolbar" | "entry";

interface Props {
  meta?: GraphMeta;
  /** Internal path to return to after login. */
  returnTo?: string;
  /** Visual variant. Toolbar is the compact map-page UI; entry is the homepage panel. */
  variant?: AuthStatusVariant;
  /** Forwarded to AccountMenu. Defaults to true. */
  showRefresh?: boolean;
}

const TOOLBAR_ANON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-alt px-2.5 py-1 text-xs text-muted transition hover:text-text";

const ENTRY_ANON_CLASS =
  "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 py-2.5 text-sm font-medium text-text transition hover:bg-panel-alt";

function buildLoginHref(returnTo?: string): string {
  if (!returnTo) return "/api/auth/github/login";
  return `/api/auth/github/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function AuthStatus({
  meta,
  returnTo,
  variant = "toolbar",
  showRefresh = true,
}: Props = {}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const fetchFn = typeof fetch === "function" ? fetch : null;
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
    if (variant === "entry") {
      return (
        <div
          data-testid="entry-authenticated-panel"
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-md border border-line bg-panel px-3 py-2"
        >
          <span className="min-w-0 truncate text-xs text-muted">
            Signed in
          </span>
          <span data-testid="auth-status-authenticated">
            <AccountMenu user={state.user} meta={meta} showRefresh={showRefresh} />
          </span>
        </div>
      );
    }
    return (
      <span data-testid="auth-status-authenticated">
        <AccountMenu user={state.user} meta={meta} showRefresh={showRefresh} />
      </span>
    );
  }

  // Anonymous
  if (variant === "entry") {
    return (
      <a
        href={buildLoginHref(returnTo)}
        data-testid="auth-status-anonymous"
        className={ENTRY_ANON_CLASS}
      >
        <GhIcon /> Sign in with GitHub
      </a>
    );
  }
  return (
    <a
      href={buildLoginHref(returnTo)}
      data-testid="auth-status-anonymous"
      className={TOOLBAR_ANON_CLASS}
    >
      <GhIcon /> Sign in
    </a>
  );
}
