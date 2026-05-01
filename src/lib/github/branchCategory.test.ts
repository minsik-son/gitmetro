import { describe, it, expect } from "vitest";
import { classifyBranchName } from "./branchCategory";

describe("classifyBranchName", () => {
  it("classifies main", () => {
    expect(classifyBranchName("main")).toBe("main");
  });

  it("classifies master", () => {
    expect(classifyBranchName("master")).toBe("main");
  });

  it("classifies develop", () => {
    expect(classifyBranchName("develop")).toBe("develop");
  });

  it("classifies dev as develop", () => {
    expect(classifyBranchName("dev")).toBe("develop");
  });

  it("classifies feature/* as feature", () => {
    expect(classifyBranchName("feature/auth")).toBe("feature");
  });

  it("classifies feat/* as feature", () => {
    expect(classifyBranchName("feat/wallet")).toBe("feature");
  });

  it("classifies hotfix/* as hotfix", () => {
    expect(classifyBranchName("hotfix/login")).toBe("hotfix");
  });

  it("classifies fix/* as hotfix", () => {
    expect(classifyBranchName("fix/session")).toBe("hotfix");
  });

  it("classifies release/* as release", () => {
    expect(classifyBranchName("release/2.4")).toBe("release");
  });

  it("classifies rc/* as release", () => {
    expect(classifyBranchName("rc/2.5.0")).toBe("release");
  });

  it("falls back to other for unknown branches", () => {
    expect(classifyBranchName("chore/update-deps")).toBe("other");
  });

  it("handles uppercase variations case-insensitively", () => {
    expect(classifyBranchName("MAIN")).toBe("main");
    expect(classifyBranchName("Feature/Login")).toBe("feature");
    expect(classifyBranchName("HOTFIX/X")).toBe("hotfix");
  });
});
