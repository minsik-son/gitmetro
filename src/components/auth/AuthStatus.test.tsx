import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
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

  it("renders the user login + logout link when authenticated", async () => {
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
    expect(screen.getByText("octocat")).toBeInTheDocument();
    const logout = screen.getByTestId("auth-logout-link");
    expect(logout.getAttribute("href")).toBe("/api/auth/github/logout");
  });

  it("falls back to anonymous on /me fetch error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    render(<AuthStatus />);
    await waitFor(() => {
      expect(screen.getByTestId("auth-status-anonymous")).toBeInTheDocument();
    });
  });
});
