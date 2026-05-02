"use client";

import { MinusIcon, PlusIcon, ResetIcon } from "@/components/ui/icons";

interface Props {
  zoom: number;
  setZoom: (updater: (z: number) => number) => void;
  setPan: (next: { x: number; y: number }) => void;
}

export function ZoomControls({ zoom, setZoom, setPan }: Props) {
  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-md border border-line bg-panel-alt px-1.5 py-1">
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-muted transition hover:bg-panel hover:text-text"
        onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
        aria-label="Zoom in"
      >
        <PlusIcon />
      </button>
      <span className="font-mono text-xs text-muted">{Math.round(zoom * 100)}%</span>
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-muted transition hover:bg-panel hover:text-text"
        onClick={() => setZoom((z) => Math.max(0.25, z - 0.15))}
        aria-label="Zoom out"
      >
        <MinusIcon />
      </button>
      <span className="mx-1 h-4 w-px bg-line" />
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-muted transition hover:bg-panel hover:text-text"
        onClick={() => {
          setZoom(() => 1);
          setPan({ x: 0, y: 0 });
        }}
        aria-label="Reset view"
      >
        <ResetIcon />
      </button>
    </div>
  );
}
