import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GitHubSignInButton } from "./GitHubSignInButton";

beforeEach(() => cleanup());

describe("GitHubSignInButton", () => {
  it("links to the OAuth login route", () => {
    render(<GitHubSignInButton />);
    const link = screen.getByTestId("github-sign-in-button");
    expect(link.getAttribute("href")).toBe("/api/auth/github/login");
  });

  it("forwards a returnTo query parameter when provided", () => {
    render(<GitHubSignInButton returnTo="/map/foo/bar" />);
    const link = screen.getByTestId("github-sign-in-button");
    expect(link.getAttribute("href")).toBe(
      "/api/auth/github/login?returnTo=%2Fmap%2Ffoo%2Fbar",
    );
  });
});
