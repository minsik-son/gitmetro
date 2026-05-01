"use client";

import type { ThemeTokens } from "@/lib/theme/themes";

export function MapLegend({ theme }: { theme: ThemeTokens }) {
  const items = [
    {
      label: "commit",
      el: (
        <circle
          cx={8}
          cy={8}
          r={4}
          fill={theme.canvas}
          stroke={theme.text}
          strokeWidth={1.6}
        />
      ),
    },
    {
      label: "merge",
      el: (
        <>
          <circle
            cx={8}
            cy={8}
            r={6}
            fill="none"
            stroke={theme.text}
            strokeWidth={1.6}
            opacity={0.5}
          />
          <circle
            cx={8}
            cy={8}
            r={3.5}
            fill={theme.canvas}
            stroke={theme.text}
            strokeWidth={1.6}
          />
        </>
      ),
    },
    {
      label: "head",
      el: (
        <>
          <circle
            cx={8}
            cy={8}
            r={4.5}
            fill={theme.canvas}
            stroke={theme.text}
            strokeWidth={1.6}
          />
          <circle cx={8} cy={8} r={2} fill={theme.text} />
        </>
      ),
    },
    {
      label: "tag",
      el: <rect x={2} y={4} width={12} height={8} rx={1.5} fill={theme.text} />,
    },
  ];

  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 rounded-md border border-line bg-panel-alt px-3 py-1.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <svg width={16} height={16}>
            {it.el}
          </svg>
          <span className="text-[11px] text-muted">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
