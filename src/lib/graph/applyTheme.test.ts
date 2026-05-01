import { describe, it, expect } from "vitest";
import { applyThemeToGraph } from "./applyTheme";
import { THEMES } from "@/lib/theme/themes";
import { MOCK_GRAPH } from "@/data/mockGraph";
import type { GitMetroGraph } from "@/types/gitmetro";

describe("applyThemeToGraph", () => {
  it("does not mutate the original graph", () => {
    const before = JSON.stringify(MOCK_GRAPH);
    applyThemeToGraph(MOCK_GRAPH, THEMES["cyberpunk"]);
    const after = JSON.stringify(MOCK_GRAPH);
    expect(after).toBe(before);
  });

  it("remaps every branch color from the theme palette", () => {
    const theme = THEMES["cyberpunk"];
    const out = applyThemeToGraph(MOCK_GRAPH, theme);
    out.branches.forEach((b) => {
      const expected =
        b.category === "other" ? theme.colors.feature : theme.colors[b.category];
      expect(b.color).toBe(expected);
    });
  });

  it("falls back to feature color for other category", () => {
    const theme = THEMES["gitmetro-dark"];
    const graph: GitMetroGraph = {
      ...MOCK_GRAPH,
      branches: [
        {
          id: "x",
          name: "x",
          category: "other",
          color: "#000",
          lane: -9,
        },
      ],
    };
    const out = applyThemeToGraph(graph, theme);
    expect(out.branches[0].color).toBe(theme.colors.feature);
  });

  it("preserves repo and commits unchanged in identity-equality terms", () => {
    const out = applyThemeToGraph(MOCK_GRAPH, THEMES["london-tube"]);
    expect(out.repo).toEqual(MOCK_GRAPH.repo);
    expect(out.commits).toEqual(MOCK_GRAPH.commits);
  });
});
