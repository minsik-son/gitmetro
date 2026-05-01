import { describe, it, expect } from "vitest";
import { selectBranches } from "./branchSelection";
import type { GitHubBranchListItem } from "@/lib/github/types";

function b(name: string, sha = name + "-sha"): GitHubBranchListItem {
  return { name, commit: { sha } };
}

describe("selectBranches", () => {
  it("always includes the default branch first", () => {
    const out = selectBranches({
      branches: [b("feature/a"), b("main"), b("develop")],
      defaultBranch: "main",
      maxBranches: 5,
    });
    expect(out[0].name).toBe("main");
    expect(out[0].isDefault).toBe(true);
  });

  it("orders categories: develop -> release -> hotfix -> feature -> other", () => {
    const branches = [
      b("main"),
      b("chore/x"),
      b("feature/a"),
      b("hotfix/h"),
      b("release/1.0"),
      b("develop"),
    ];
    const out = selectBranches({
      branches,
      defaultBranch: "main",
      maxBranches: 6,
    });
    const order = out.map((s) => s.name);
    expect(order).toEqual([
      "main",
      "develop",
      "release/1.0",
      "hotfix/h",
      "feature/a",
      "chore/x",
    ]);
  });

  it("caps at maxBranches", () => {
    const branches = [
      b("main"),
      b("develop"),
      b("feature/a"),
      b("feature/b"),
      b("feature/c"),
    ];
    const out = selectBranches({
      branches,
      defaultBranch: "main",
      maxBranches: 3,
    });
    expect(out).toHaveLength(3);
    expect(out[0].name).toBe("main");
  });

  it("sorts alphabetically inside a category", () => {
    const branches = [
      b("main"),
      b("feature/zeta"),
      b("feature/alpha"),
      b("feature/mid"),
    ];
    const out = selectBranches({
      branches,
      defaultBranch: "main",
      maxBranches: 4,
    });
    expect(out.slice(1).map((s) => s.name)).toEqual([
      "feature/alpha",
      "feature/mid",
      "feature/zeta",
    ]);
  });

  it("classifies branches by name", () => {
    const out = selectBranches({
      branches: [b("main"), b("feature/x"), b("hotfix/y"), b("release/z"), b("misc")],
      defaultBranch: "main",
      maxBranches: 10,
    });
    const cat = (n: string) => out.find((b) => b.name === n)?.category;
    expect(cat("main")).toBe("main");
    expect(cat("feature/x")).toBe("feature");
    expect(cat("hotfix/y")).toBe("hotfix");
    expect(cat("release/z")).toBe("release");
    expect(cat("misc")).toBe("other");
  });
});
