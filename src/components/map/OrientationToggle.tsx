"use client";

import { HorizIcon, VertIcon } from "@/components/ui/icons";
import type { MapOrientation } from "@/types/gitmetro";

interface Props {
  value: MapOrientation;
  onChange: (next: MapOrientation) => void;
}

export function OrientationToggle({ value, onChange }: Props) {
  const options: { value: MapOrientation; label: string; icon: React.ReactNode }[] =
    [
      { value: "horizontal", label: "Horizontal", icon: <HorizIcon /> },
      { value: "vertical", label: "Vertical", icon: <VertIcon /> },
    ];
  return (
    <div className="inline-flex items-center rounded-md border border-line bg-panel-alt p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            title={o.label}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition ${
              active ? "bg-panel text-text" : "text-muted hover:text-text"
            }`}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
