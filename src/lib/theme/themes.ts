import type { BranchCategory, ThemeKey } from "@/types/gitmetro";

export interface ThemeTokens {
  key: ThemeKey;
  label: string;
  app: string;
  panel: string;
  panelAlt: string;
  border: string;
  canvas: string;
  guide: string;
  text: string;
  textMuted: string;
  labelText: string;
  tagBg: string;
  tagText: string;
  lineWidth: number;
  colors: Record<Exclude<BranchCategory, "other">, string>;
}

export const THEMES: Record<ThemeKey, ThemeTokens> = {
  "gitmetro-dark": {
    key: "gitmetro-dark",
    label: "GitMetro Dark",
    app: "#0b0d10",
    panel: "#11141a",
    panelAlt: "#161a21",
    border: "#222732",
    canvas: "#0a0c10",
    guide: "#252b36",
    text: "#e6e8ec",
    textMuted: "#8a92a3",
    labelText: "#0a0c10",
    tagBg: "#1f2530",
    tagText: "#e6e8ec",
    lineWidth: 3.5,
    colors: {
      main: "#ff5b5b",
      hotfix: "#ff9f43",
      develop: "#f3d54e",
      feature: "#3ddbd9",
      release: "#4aa3ff",
    },
  },
  "london-tube": {
    key: "london-tube",
    label: "London Tube",
    app: "#0e1116",
    panel: "#141821",
    panelAlt: "#191e28",
    border: "#272d3a",
    canvas: "#f3eedf",
    guide: "#cfc7b1",
    text: "#e6e8ec",
    textMuted: "#8a92a3",
    labelText: "#f3eedf",
    tagBg: "#1f2530",
    tagText: "#f3eedf",
    lineWidth: 4.5,
    colors: {
      main: "#dc241f",
      hotfix: "#f3a52b",
      develop: "#a1a5a8",
      feature: "#0019a8",
      release: "#003688",
    },
  },
  cyberpunk: {
    key: "cyberpunk",
    label: "Cyberpunk",
    app: "#08060f",
    panel: "#0e0a1c",
    panelAlt: "#140e26",
    border: "#2a1d49",
    canvas: "#06050b",
    guide: "#221540",
    text: "#f0e9ff",
    textMuted: "#8b7eb8",
    labelText: "#06050b",
    tagBg: "#1a0f33",
    tagText: "#f0e9ff",
    lineWidth: 3.5,
    colors: {
      main: "#ff3df0",
      hotfix: "#ffb000",
      develop: "#c8ff5e",
      feature: "#00f0ff",
      release: "#7a5cff",
    },
  },
  "skill-tree": {
    key: "skill-tree",
    label: "Skill Tree",
    app: "#0a0d0c",
    panel: "#10151a",
    panelAlt: "#161d24",
    border: "#22303a",
    canvas: "#0a1014",
    guide: "#1f2b35",
    text: "#e8f0ee",
    textMuted: "#8aa1a6",
    labelText: "#0a1014",
    tagBg: "#152028",
    tagText: "#e8f0ee",
    lineWidth: 4,
    colors: {
      main: "#ffd166",
      hotfix: "#ef476f",
      develop: "#06d6a0",
      feature: "#8ecae6",
      release: "#bb9bff",
    },
  },
};

export function colorForCategory(theme: ThemeTokens, category: BranchCategory): string {
  if (category === "other") return theme.colors.feature;
  return theme.colors[category];
}
