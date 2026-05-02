import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createRandomState,
  decryptJson,
  encryptJson,
  safeEqual,
} from "./crypto";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("AUTH_SECRET", "test-secret-32-bytes-of-entropy-here-1234567890");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encryptJson / decryptJson", () => {
  it("round-trips an object", () => {
    const value = { hello: "world", n: 42 };
    const token = encryptJson(value);
    expect(typeof token).toBe("string");
    expect(token).not.toContain("hello");
    const out = decryptJson<typeof value>(token);
    expect(out).toEqual(value);
  });

  it("returns null on tampered token", () => {
    const value = { foo: "bar" };
    const token = encryptJson(value);
    const tampered = token.slice(0, -2) + "AA";
    expect(decryptJson(tampered)).toBeNull();
  });

  it("returns null on garbage input", () => {
    expect(decryptJson("not-a-real-token")).toBeNull();
    expect(decryptJson("")).toBeNull();
  });

  it("returns null when decrypted with a different secret", () => {
    const value = { foo: "bar" };
    const token = encryptJson(value);
    vi.stubEnv("AUTH_SECRET", "a-different-secret-value-with-enough-entropy");
    expect(decryptJson(token)).toBeNull();
  });

  it("throws when AUTH_SECRET is missing", () => {
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => encryptJson({ a: 1 })).toThrow(/AUTH_SECRET/);
  });
});

describe("createRandomState", () => {
  it("returns a non-empty unique string per call", () => {
    const a = createRandomState();
    const b = createRandomState();
    expect(a.length).toBeGreaterThan(16);
    expect(a).not.toBe(b);
  });
});

describe("safeEqual", () => {
  it("returns true for identical strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
