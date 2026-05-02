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
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { GitHubGraphLoader } from "./GitHubGraphLoader";
import { MOCK_GRAPH } from "@/data/mockGraph";
import type {
  GraphApiSuccess,
  GraphApiFailure,
} from "@/lib/github/api-types";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

const successBody: GraphApiSuccess = {
  ok: true,
  graph: MOCK_GRAPH,
  meta: {
    source: "github",
    owner: MOCK_GRAPH.repo.owner,
    repo: MOCK_GRAPH.repo.name,
    truncated: false,
    selectedBranches: MOCK_GRAPH.branches.length,
    fetchedCommits: MOCK_GRAPH.commits.length,
    maxBranches: 12,
    commitLimit: 500,
    warnings: [],
    history: {
      enabled: true,
      historicalBranches: 0,
      capped: false,
      source: "first-parent-merge",
    },
  },
};

const failureBody: GraphApiFailure = {
  ok: false,
  error: {
    code: "not_found",
    message: "Not Found",
    status: 404,
  },
};

describe("GitHubGraphLoader", () => {
  it("shows the loading terminal while fetch is pending", () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    render(<GitHubGraphLoader owner="x" repo="y" />);
    expect(screen.getByText(/gitmetro@core/i)).toBeInTheDocument();
  });

  it("renders the map shell when the API responds with success", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(successBody));
    render(<GitHubGraphLoader owner="x" repo="y" />);
    await waitFor(() =>
      expect(screen.getByTestId("metro-canvas")).toBeInTheDocument(),
    );
  });

  it("renders the error panel when the API responds with failure", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(failureBody, { status: 404 }));
    render(<GitHubGraphLoader owner="x" repo="y" />);
    await waitFor(() =>
      expect(screen.getByTestId("github-graph-error")).toBeInTheDocument(),
    );
    expect(screen.getByText(/HTTP 404/)).toBeInTheDocument();
  });

  it("calls the API again when retry is pressed", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(failureBody, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse(successBody));
    render(<GitHubGraphLoader owner="x" repo="y" />);
    await waitFor(() =>
      expect(screen.getByTestId("github-graph-error")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() =>
      expect(screen.getByTestId("metro-canvas")).toBeInTheDocument(),
    );
    const graphCalls = mockFetch.mock.calls.filter(
      (call) =>
        typeof call[0] === "string" &&
        (call[0] as string).includes("/api/github/graph"),
    );
    expect(graphCalls).toHaveLength(2);
  });

  it("treats a network error as github_unavailable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network down"));
    render(<GitHubGraphLoader owner="x" repo="y" />);
    await waitFor(() =>
      expect(screen.getByTestId("github-graph-error")).toBeInTheDocument(),
    );
    expect(screen.getByText(/github_unavailable/)).toBeInTheDocument();
  });
});
