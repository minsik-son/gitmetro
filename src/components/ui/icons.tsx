const i = {
  stroke: "currentColor",
  fill: "none",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function GhIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 .2a8 8 0 0 0-2.5 15.6c.4.1.6-.2.6-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3s1.4.1 2 .3c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.2.6.7.6 1.5v2.2c0 .2.2.5.6.4A8 8 0 0 0 8 .2z"
      />
    </svg>
  );
}

export function HorizIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden {...i}>
      <path d="M2 8h12M5 5l-3 3 3 3M11 5l3 3-3 3" />
    </svg>
  );
}

export function VertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden {...i}>
      <path d="M8 2v12M5 5L8 2l3 3M5 11l3 3 3-3" />
    </svg>
  );
}

export function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden {...i}>
      <path d="M8 11V2M5 5l3-3 3 3M2 11v3h12v-3" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden {...i}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function BranchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden {...i}>
      <circle cx="4" cy="4" r="1.5" />
      <circle cx="4" cy="12" r="1.5" />
      <circle cx="12" cy="6" r="1.5" />
      <path d="M4 5.5v5M5.5 6c1.5 0 5 0 5 0" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden {...i}>
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3 3" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden {...i}>
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5S1 8 1 8z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden {...i}>
      <path d="M2 2l12 12M6.7 6.7A2 2 0 0 0 8 10a2 2 0 0 0 1.3-.5M3 5C2 6.4 1 8 1 8s2.5 5 7 5c1.4 0 2.6-.4 3.6-.9M7 3c4.4 0 7 5 7 5s-.5 1-1.4 2" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden {...i}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden {...i}>
      <path d="M3 8h10" />
    </svg>
  );
}

export function ResetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden {...i}>
      <path d="M3 8a5 5 0 1 0 1.5-3.5L3 6M3 3v3h3" />
    </svg>
  );
}
