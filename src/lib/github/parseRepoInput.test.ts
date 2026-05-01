import { describe, it, expect } from "vitest";
import { parseRepoInput } from "./parseRepoInput";

describe("parseRepoInput", () => {
  it("parses owner/repo shorthand", () => {
    const result = parseRepoInput("facebook/react");
    expect(result).toEqual({ ok: true, value: { owner: "facebook", repo: "react" } });
  });

  it("parses https github URL", () => {
    const result = parseRepoInput("https://github.com/facebook/react");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ owner: "facebook", repo: "react" });
  });

  it("parses http github URL", () => {
    const result = parseRepoInput("http://github.com/facebook/react");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ owner: "facebook", repo: "react" });
  });

  it("parses bare github.com prefix", () => {
    const result = parseRepoInput("github.com/facebook/react");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ owner: "facebook", repo: "react" });
  });

  it("strips trailing .git suffix", () => {
    const result = parseRepoInput("https://github.com/facebook/react.git");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ owner: "facebook", repo: "react" });
  });

  it("trims surrounding whitespace", () => {
    const result = parseRepoInput("  facebook/react  ");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ owner: "facebook", repo: "react" });
  });

  it("rejects empty input", () => {
    const result = parseRepoInput("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/enter/i);
  });

  it("rejects owner-only input", () => {
    const result = parseRepoInput("facebook");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/owner\/repo/i);
  });

  it("rejects invalid characters", () => {
    const result = parseRepoInput("facebook/re$ct");
    expect(result.ok).toBe(false);
  });

  it("accepts dots, dashes, underscores in segments", () => {
    const result = parseRepoInput("lumen-labs/lumen.pay_app");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.owner).toBe("lumen-labs");
      expect(result.value.repo).toBe("lumen.pay_app");
    }
  });

  it("ignores trailing slashes", () => {
    const result = parseRepoInput("https://github.com/facebook/react/");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ owner: "facebook", repo: "react" });
  });
});
