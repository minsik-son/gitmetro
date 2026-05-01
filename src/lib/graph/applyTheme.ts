import type { GitMetroGraph } from "@/types/gitmetro";
import { type ThemeTokens, colorForCategory } from "@/lib/theme/themes";

export function applyThemeToGraph(graph: GitMetroGraph, theme: ThemeTokens): GitMetroGraph {
  return {
    ...graph,
    branches: graph.branches.map((b) => ({
      ...b,
      color: colorForCategory(theme, b.category),
    })),
  };
}
