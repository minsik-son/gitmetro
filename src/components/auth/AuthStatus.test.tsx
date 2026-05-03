import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { AuthStatus } from "./AuthStatus";

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

describe("AuthStatus", () => {
  it("renders a Sign in CTA when /me reports anonymous", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, authenticated: false, user: null }),
    );
    render(<AuthStatus />);
    await waitFor(() => {
      expect(screen.getByTestId("auth-status-anonymous")).toBeInTheDocument();
    });
    const link = screen.getByTestId("auth-status-anonymous");
    expect(link.getAttribute("href")).toBe("/api/auth/github/login");
  });

  it("encodes returnTo in the anonymous Sign in href", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, authenticated: false, user: null }),
    );
    render(<AuthStatus returnTo="/map/foo/bar" />);
    await waitFor(() => {
      expect(screen.getByTestId("auth-status-anonymous")).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("auth-status-anonymous").getAttribute("href"),
    ).toBe("/api/auth/github/login?returnTo=%2Fmap%2Ffoo%2Fbar");
  });

  it("renders the AccountMenu when authenticated", async () => {
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
    render(<AuthStatus />);
    await waitFor(() => {
      expect(
        screen.getByTestId("auth-status-authenticated"),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("account-menu-button")).toBeInTheDocument();
    expect(screen.getByText("octocat")).toBeInTheDocument();
  });

  it("forwards meta to AccountMenu so the rate badge appears", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        authenticated: true,
        user: {
          provider: "github",
          login: "octocat",
          avatarUrl: "u",
          name: null,
          scope: "read:user",
        },
      }),
    );
    render(
      <AuthStatus
        meta={{
          source: "github",
          owner: "x",
          repo: "y",
          truncated: false,
          selectedBranches: 1,
          fetchedCommits: 1,
          maxBranches: 12,
          commitLimit: 500,
          warnings: [],
          history: {
            enabled: true,
            historicalBranches: 0,
            capped: false,
            source: "first-parent-merge",
          },
          rateLimit: { limit: 5000, remaining: 4321 },
          auth: { authenticated: true, source: "oauth", login: "octocat" },
        }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("account-menu-button")).toBeInTheDocument();
    });
    expect(screen.getByTestId("account-menu-rate-badge")).toHaveTextContent(
      /4,321/,
    );
  });

  it("falls back to anonymous on /me fetch error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    render(<AuthStatus />);
    await waitFor(() => {
      expect(screen.getByTestId("auth-status-anonymous")).toBeInTheDocument();
    });
  });
});

describe("AuthStatus entry variant", () => {
  it("renders a full-width Sign in with GitHub button when anonymous", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ok: true, authenticated: false, user: null }),
    );
    render(<AuthStatus variant="entry" returnTo="/" />);
    await waitFor(() => {
      expect(screen.getByTestId("auth-status-anonymous")).toBeInTheDocument();
    });
    const link = screen.getByTestId("auth-status-anonymous");
    expect(link).toHaveTextContent(/sign in with github/i);
    expect(link.className).toContain("w-full");
    expect(link.className).toContain("text-sm");
    expect(link.getAttribute("href")).toBe(
      "/api/auth/github/login?returnTo=%2F",
    );
  });

  it("renders the entry-authenticated-panel with AccountMenu when signed in", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        authenticated: true,
        user: {
          provider: "github",
          login: "octocat",
          avatarUrl: "u",
          name: "Octocat",
          scope: "read:user",
        },
      }),
    );
    render(<AuthStatus variant="entry" returnTo="/" showRefresh={false} />);
    await waitFor(() => {
      expect(screen.getByTestId("entry-authenticated-panel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("account-menu-button")).toBeInTheDocument();
    expect(screen.getByText("octocat")).toBeInTheDocument();
    // Refresh graph hidden for entry variant.
    fireEvent.click(screen.getByTestId("account-menu-button"));
    expect(screen.queryByTestId("account-menu-refresh")).not.toBeInTheDocument();
  });
});
