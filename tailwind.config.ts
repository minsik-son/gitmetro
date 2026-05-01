import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        app: "var(--app)",
        panel: "var(--panel)",
        "panel-alt": "var(--panel-alt)",
        line: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        canvas: "var(--canvas)",
        guide: "var(--guide)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
