import { classifyBranchName } from "@/lib/github/branchCategory";
import type { GitHubBranchListItem } from "@/lib/github/types";
import type { BranchCategory } from "@/types/gitmetro";

export interface SelectedBranch {
  name: string;
  category: BranchCategory;
  headSha: string;
  isDefault: boolean;
}

const PRIORITY: BranchCategory[] = [
  "main",
  "develop",
  "release",
  "hotfix",
  "feature",
  "other",
];

export interface BranchSelectionInput {
  branches: GitHubBranchListItem[];
  defaultBranch: string;
  maxBranches: number;
}

export function selectBranches(input: BranchSelectionInput): SelectedBranch[] {
  const seen = new Set<string>();
  const enriched: SelectedBranch[] = [];

  // 1. Always include the default branch first if present.
  const def = input.branches.find((b) => b.name === input.defaultBranch);
  if (def && !seen.has(def.name)) {
    enriched.push({
      name: def.name,
      category: "main",
      headSha: def.commit.sha,
      isDefault: true,
    });
    seen.add(def.name);
  }

  // 2. Group remaining branches by category, sorted alphabetically inside each.
  const remaining = input.branches.filter((b) => !seen.has(b.name));
  const byCategory: Record<BranchCategory, SelectedBranch[]> = {
    main: [],
    develop: [],
    feature: [],
    hotfix: [],
    release: [],
    other: [],
  };
  remaining.forEach((b) => {
    const category = classifyBranchName(b.name);
    byCategory[category].push({
      name: b.name,
      category,
      headSha: b.commit.sha,
      isDefault: false,
    });
  });
  Object.values(byCategory).forEach((list) =>
    list.sort((a, b) => a.name.localeCompare(b.name)),
  );

  // 3. Walk the priority list in order, appending until we hit maxBranches.
  for (const cat of PRIORITY) {
    if (cat === "main") {
      // already taken care of by the default branch step; any branch literally
      // named "main"/"master" that isn't the default still counts as main category.
      for (const b of byCategory.main) {
        if (enriched.length >= input.maxBranches) break;
        if (seen.has(b.name)) continue;
        enriched.push(b);
        seen.add(b.name);
      }
      continue;
    }
    for (const b of byCategory[cat]) {
      if (enriched.length >= input.maxBranches) break;
      if (seen.has(b.name)) continue;
      enriched.push(b);
      seen.add(b.name);
    }
    if (enriched.length >= input.maxBranches) break;
  }

  return enriched.slice(0, Math.max(1, input.maxBranches));
}
