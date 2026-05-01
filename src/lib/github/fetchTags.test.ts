import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchTags } from "./fetchTags";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("fetchTags", () => {
  it("returns tags on success without warning", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { name: "v1.0.0", commit: { sha: "a" } },
        { name: "v1.1.0", commit: { sha: "b" } },
      ]),
    );
    const result = await fetchTags("o", "r");
    expect(result.tags).toHaveLength(2);
    expect(result.warning).toBeUndefined();
  });

  it("soft-fails to empty tags + warning on error", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ message: "Not Found" }, { status: 404 }),
    );
    const result = await fetchTags("o", "r");
    expect(result.tags).toEqual([]);
    expect(result.warning).toMatch(/tags fetch failed/);
  });

  it("soft-fails on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await fetchTags("o", "r");
    expect(result.tags).toEqual([]);
    expect(result.warning).toMatch(/tags fetch failed/);
  });
});
