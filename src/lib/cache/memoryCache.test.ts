import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  clearCacheForTests,
  getCached,
  getOrSetCached,
  setCached,
} from "./memoryCache";

describe("memoryCache", () => {
  beforeEach(() => {
    clearCacheForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearCacheForTests();
  });

  it("returns null when key is missing", () => {
    expect(getCached("missing")).toBeNull();
  });

  it("stores and retrieves a value within TTL", () => {
    setCached("k", { a: 1 }, 1_000);
    expect(getCached<{ a: number }>("k")).toEqual({ a: 1 });
  });

  it("expires entries after the TTL elapses", () => {
    setCached("k", "value", 500);
    vi.advanceTimersByTime(499);
    expect(getCached<string>("k")).toBe("value");
    vi.advanceTimersByTime(2);
    expect(getCached<string>("k")).toBeNull();
  });

  it("ignores non-positive TTL values", () => {
    setCached("k", 1, 0);
    expect(getCached<number>("k")).toBeNull();
    setCached("k2", 1, -1);
    expect(getCached<number>("k2")).toBeNull();
  });

  it("getOrSetCached calls loader once and reuses cached value", async () => {
    const loader = vi.fn(async () => 42);
    const a = await getOrSetCached("k", 1_000, loader);
    const b = await getOrSetCached("k", 1_000, loader);
    expect(a).toBe(42);
    expect(b).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("getOrSetCached calls loader again after expiry", async () => {
    const loader = vi.fn(async () => Math.random());
    await getOrSetCached("k", 100, loader);
    vi.advanceTimersByTime(101);
    await getOrSetCached("k", 100, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("clearCacheForTests removes all entries", () => {
    setCached("a", 1, 10_000);
    setCached("b", 2, 10_000);
    clearCacheForTests();
    expect(getCached("a")).toBeNull();
    expect(getCached("b")).toBeNull();
  });
});
