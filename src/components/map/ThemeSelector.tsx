"use client";

import { ChevronIcon } from "@/components/ui/icons";
import { THEMES } from "@/lib/theme/themes";
import type { ThemeKey } from "@/types/gitmetro";

interface Props {
  value: ThemeKey;
  onChange: (next: ThemeKey) => void;
}

export function ThemeSelector({ value, onChange }: Props) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ThemeKey)}
        className="appearance-none rounded-md border border-line bg-panel-alt px-2.5 py-1 pr-7 text-xs text-text outline-none transition hover:border-muted"
      >
        {Object.values(THEMES).map((t) => (
          <option key={t.key} value={t.key} className="bg-panel text-text">
            {t.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 text-muted">
        <ChevronIcon />
      </span>
    </div>
  );
}
