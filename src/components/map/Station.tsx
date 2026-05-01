"use client";

import type { CommitNode } from "@/types/gitmetro";
import type { Point } from "@/lib/layout/buildLayout";
import type { ThemeTokens } from "@/lib/theme/themes";
import type { MouseEvent } from "react";

export type NodeStyle = "ring" | "dot" | "square";

interface Props {
  commit: CommitNode;
  pos: Point;
  color: string;
  nodeStyle: NodeStyle;
  theme: ThemeTokens;
  selected: boolean;
  onSelect: () => void;
  onHover: (e: MouseEvent<SVGGElement>) => void;
  onHoverEnd: () => void;
}

export function Station({
  commit,
  pos,
  color,
  nodeStyle,
  theme,
  selected,
  onSelect,
  onHover,
  onHoverEnd,
}: Props) {
  const r = commit.isMerge ? 8 : commit.isHead ? 7 : 5.5;
  const strokeW = commit.isMerge ? 3 : 2;
  const fill = nodeStyle === "dot" ? color : theme.canvas;

  return (
    <g
      transform={`translate(${pos.x},${pos.y})`}
      style={{ cursor: "pointer" }}
      data-testid={`station-${commit.sha}`}
      role="button"
      aria-label={`Commit ${commit.shortSha}: ${commit.message}`}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onMouseLeave={onHoverEnd}
      onClick={(e) => {
        e.stopPropagation();
        onHoverEnd();
        onSelect();
      }}
    >
      {selected && (
        <circle
          r={r + 7}
          fill="none"
          stroke={color}
          strokeOpacity={0.35}
          strokeWidth={2}
        />
      )}
      {nodeStyle === "square" ? (
        <rect
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          fill={fill}
          stroke={color}
          strokeWidth={strokeW}
          rx={1.5}
        />
      ) : nodeStyle === "dot" ? (
        <>
          <circle r={r + 1.5} fill={color} opacity={0.18} />
          <circle r={r} fill={color} />
        </>
      ) : (
        <>
          {commit.isMerge && (
            <circle
              r={r + 3}
              fill="none"
              stroke={color}
              strokeWidth={2}
              opacity={0.5}
            />
          )}
          <circle r={r} fill={fill} stroke={color} strokeWidth={strokeW} />
          {commit.isHead && <circle r={r - 2.5} fill={color} />}
        </>
      )}
      {commit.isTag && commit.tag && (
        <g transform={`translate(${10},${-12})`}>
          <rect width={Math.max(38, commit.tag.length * 6)} height={14} rx={2} fill={theme.tagBg} />
          <text
            x={Math.max(38, commit.tag.length * 6) / 2}
            y={10}
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize={9}
            fill={theme.tagText}
            fontWeight={600}
          >
            {commit.tag}
          </text>
        </g>
      )}
    </g>
  );
}
