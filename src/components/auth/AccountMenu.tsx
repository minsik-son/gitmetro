"use client";

import { useEffect, useRef, useState } from "react";
import { GhIcon } from "@/components/ui/icons";
import type { AuthUser } from "@/lib/auth/types";
import type { GraphMeta } from "@/lib/github/api-types";

interface Props {
  user: AuthUser;
  meta?: GraphMeta;
  /** Override default refresh behavior (used by tests). Defaults to window.location.reload(). */
  onRefresh?: () => void;
  /** When false, hides the Refresh graph menu item. Defaults to true. */
  showRefresh?: boolean;
}

const AUTH_SOURCE_LABEL: Record<string, string> = {
  oauth: "OAuth",
  env: "Server token",
  none: "Anonymous",
};

function formatRateLimit(meta: GraphMeta | undefined): string | null {
  const remaining = meta?.rateLimit?.remaining;
  const limit = meta?.rateLimit?.limit;
  if (remaining == null || limit == null) return null;
  return `${remaining.toLocaleString()} / ${limit.toLocaleString()}`;
}

function formatRateBadge(meta: GraphMeta | undefined): string | null {
  const remaining = meta?.rateLimit?.remaining;
  if (remaining == null) return null;
  return remaining.toLocaleString();
}

function formatReset(reset: number | undefined): string | null {
  if (!reset) return null;
  return new Date(reset * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AccountMenu({ user, meta, onRefresh, showRefresh = true }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const node = containerRef.current;
      if (!node) return;
      if (node.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const rateText = formatRateLimit(meta);
  const rateBadge = formatRateBadge(meta);
  const resetText = formatReset(meta?.rateLimit?.reset);
  const sourceLabel = meta?.auth?.source
    ? AUTH_SOURCE_LABEL[meta.auth.source] ?? meta.auth.source
    : AUTH_SOURCE_LABEL.oauth;

  const handleRefresh = () => {
    setOpen(false);
    if (onRefresh) {
      onRefresh();
      return;
    }
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <div ref={containerRef} className="relative">
        <button
          type="button"
          data-testid="account-menu-button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md border border-line bg-panel-alt px-2 py-1 text-xs text-text transition hover:bg-panel"
        >
          {user.avatarUrl ? (
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
          <span aria-hidden className="text-muted">
            ▾
          </span>
        </button>

        {open && (
          <div
            role="menu"
            data-testid="account-menu-dropdown"
            className="absolute right-0 top-full z-30 mt-2 w-64 rounded-md border border-line bg-panel p-3 text-xs text-text shadow-xl"
          >
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted">
              GitHub Account
            </div>
            <div className="flex items-center gap-2">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              ) : (
                <GhIcon />
              )}
              <div className="min-w-0 flex-1">
                {user.name && (
                  <div className="truncate text-sm font-medium">{user.name}</div>
                )}
                <div className="font-mono text-[11px] text-muted">
                  @{user.login}
                </div>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[11px]">
              <dt className="text-muted">Auth source</dt>
              <dd
                data-testid="account-menu-source"
                className="text-right font-mono"
              >
                {sourceLabel}
              </dd>
              {user.scope && (
                <>
                  <dt className="text-muted">Scope</dt>
                  <dd
                    data-testid="account-menu-scope"
                    className="break-words text-right font-mono"
                  >
                    {user.scope}
                  </dd>
                </>
              )}
              {rateText && (
                <>
                  <dt className="text-muted">Rate limit</dt>
                  <dd
                    data-testid="account-menu-rate"
                    className="text-right font-mono"
                  >
                    {rateText}
                  </dd>
                </>
              )}
              {resetText && (
                <>
                  <dt className="text-muted">Reset</dt>
                  <dd
                    data-testid="account-menu-reset"
                    className="text-right font-mono"
                  >
                    {resetText}
                  </dd>
                </>
              )}
            </dl>

            <div className="mt-3 flex flex-col gap-1 border-t border-line pt-2">
              <a
                href={`https://github.com/${user.login}`}
                target="_blank"
                rel="noreferrer"
                role="menuitem"
                data-testid="account-menu-profile"
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-text transition hover:bg-panel-alt"
              >
                Open GitHub profile
              </a>
              {showRefresh && (
                <button
                  type="button"
                  role="menuitem"
                  data-testid="account-menu-refresh"
                  onClick={handleRefresh}
                  className="rounded px-2 py-1 text-left text-text transition hover:bg-panel-alt"
                >
                  Refresh graph
                </button>
              )}
              <a
                href="/api/auth/github/logout"
                role="menuitem"
                data-testid="account-menu-logout"
                className="rounded px-2 py-1 text-text transition hover:bg-panel-alt"
              >
                Sign out
              </a>
            </div>
          </div>
        )}
      </div>

      {rateBadge && (
        <span
          data-testid="account-menu-rate-badge"
          className="hidden items-center rounded-full border border-line bg-panel-alt px-2 py-0.5 font-mono text-[10px] text-muted md:inline-flex"
        >
          API {rateBadge}
        </span>
      )}
    </span>
  );
}
