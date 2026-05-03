import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AccountMenu } from "./AccountMenu";
import type { AuthUser } from "@/lib/auth/types";
import type { GraphMeta } from "@/lib/github/api-types";

const user: AuthUser = {
  provider: "github",
  login: "octocat",
  avatarUrl: "https://example.test/octocat.png",
  name: "Octocat",
  scope: "read:user",
};

function metaWithRate(): GraphMeta {
  return {
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
    rateLimit: { limit: 5000, remaining: 4987, reset: 1714530000 },
    auth: { authenticated: true, source: "oauth", login: "octocat" },
  };
}

beforeEach(() => cleanup());
afterEach(() => cleanup());

describe("AccountMenu", () => {
  it("renders the account button with avatar and login", () => {
    render(<AccountMenu user={user} />);
    expect(screen.getByTestId("account-menu-button")).toBeInTheDocument();
    expect(screen.getByText("octocat")).toBeInTheDocument();
  });

  it("does not render the dropdown until the button is clicked", () => {
    render(<AccountMenu user={user} />);
    expect(screen.queryByTestId("account-menu-dropdown")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("account-menu-button"));
    expect(screen.getByTestId("account-menu-dropdown")).toBeInTheDocument();
  });

  it("shows the user name, scope, source, and rate limit when meta is present", () => {
    render(<AccountMenu user={user} meta={metaWithRate()} />);
    fireEvent.click(screen.getByTestId("account-menu-button"));
    expect(screen.getByText("Octocat")).toBeInTheDocument();
    expect(screen.getByText("@octocat")).toBeInTheDocument();
    expect(screen.getByTestId("account-menu-source")).toHaveTextContent(/oauth/i);
    expect(screen.getByTestId("account-menu-scope")).toHaveTextContent("read:user");
    expect(screen.getByTestId("account-menu-rate")).toHaveTextContent(
      "4,987 / 5,000",
    );
    expect(screen.getByTestId("account-menu-reset")).toBeInTheDocument();
  });

  it("renders an API badge next to the button when remaining is known", () => {
    render(<AccountMenu user={user} meta={metaWithRate()} />);
    expect(screen.getByTestId("account-menu-rate-badge")).toHaveTextContent(
      /API\s+4,987/,
    );
  });

  it("links the GitHub profile and logout actions to the right URLs", () => {
    render(<AccountMenu user={user} />);
    fireEvent.click(screen.getByTestId("account-menu-button"));
    const profile = screen.getByTestId("account-menu-profile");
    expect(profile.getAttribute("href")).toBe("https://github.com/octocat");
    expect(profile.getAttribute("target")).toBe("_blank");
    expect(profile.getAttribute("rel")).toBe("noreferrer");
    const logout = screen.getByTestId("account-menu-logout");
    expect(logout.getAttribute("href")).toBe("/api/auth/github/logout");
  });

  it("calls onRefresh when the Refresh graph item is clicked, and closes the menu", () => {
    const onRefresh = vi.fn();
    render(<AccountMenu user={user} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("account-menu-button"));
    fireEvent.click(screen.getByTestId("account-menu-refresh"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("account-menu-dropdown")).not.toBeInTheDocument();
  });

  it("closes on Escape key", () => {
    render(<AccountMenu user={user} />);
    fireEvent.click(screen.getByTestId("account-menu-button"));
    expect(screen.getByTestId("account-menu-dropdown")).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByTestId("account-menu-dropdown")).not.toBeInTheDocument();
  });

  it("closes when clicking outside the menu container", () => {
    render(
      <div>
        <AccountMenu user={user} />
        <button data-testid="outside">outside</button>
      </div>,
    );
    fireEvent.click(screen.getByTestId("account-menu-button"));
    expect(screen.getByTestId("account-menu-dropdown")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByTestId("account-menu-dropdown")).not.toBeInTheDocument();
  });

  it("hides the Refresh graph item when showRefresh is false", () => {
    render(<AccountMenu user={user} showRefresh={false} />);
    fireEvent.click(screen.getByTestId("account-menu-button"));
    expect(screen.queryByTestId("account-menu-refresh")).not.toBeInTheDocument();
    // Profile and logout still present.
    expect(screen.getByTestId("account-menu-profile")).toBeInTheDocument();
    expect(screen.getByTestId("account-menu-logout")).toBeInTheDocument();
  });

  it("toggles aria-expanded on the button", () => {
    render(<AccountMenu user={user} />);
    const button = screen.getByTestId("account-menu-button");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });
});
