import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import EntryPage from "./page";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

describe("EntryPage", () => {
  it("renders the GitHub Sign in button when /me reports anonymous", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, authenticated: false, user: null }),
    );
    render(<EntryPage />);
    await waitFor(() => {
      expect(screen.getByTestId("auth-status-anonymous")).toBeInTheDocument();
    });
    expect(screen.getByText(/sign in with github/i)).toBeInTheDocument();
    expect(screen.queryByTestId("entry-authenticated-panel")).not.toBeInTheDocument();
  });

  it("renders the authenticated account panel when /me reports a session", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        authenticated: true,
        user: {
          provider: "github",
          login: "octocat",
          avatarUrl: "https://example.test/octocat.png",
          name: "Octocat",
          scope: "read:user",
        },
      }),
    );
    render(<EntryPage />);
    await waitFor(() => {
      expect(screen.getByTestId("entry-authenticated-panel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("account-menu-button")).toBeInTheDocument();
    expect(screen.getByText("octocat")).toBeInTheDocument();
    // Static GitHubSignInButton should not be in the entry tree anymore.
    expect(
      screen.queryByTestId("github-sign-in-button"),
    ).not.toBeInTheDocument();
  });
});
