import type { BranchCategory } from "@/types/gitmetro";

export function classifyBranchName(name: string): BranchCategory {
  const lower = name.toLowerCase();
  if (lower === "main" || lower === "master") return "main";
  if (lower === "develop" || lower === "dev") return "develop";
  if (lower.startsWith("feature/") || lower.startsWith("feat/")) return "feature";
  if (lower.startsWith("hotfix/") || lower.startsWith("fix/")) return "hotfix";
  if (lower.startsWith("release/") || lower.startsWith("rc/")) return "release";
  return "other";
}
