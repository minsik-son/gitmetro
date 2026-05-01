import { THEMES } from "@/lib/theme/themes";

export function Logo({ size = 22 }: { size?: number }) {
  const c = THEMES["gitmetro-dark"].colors;
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
        <circle cx="11" cy="11" r="9" fill="none" stroke={c.main} strokeWidth="2.5" />
        <line x1="2" y1="11" x2="20" y2="11" stroke={c.feature} strokeWidth="2.5" />
        <circle cx="6" cy="11" r="2" fill={c.develop} />
        <circle cx="16" cy="11" r="2" fill={c.hotfix} />
      </svg>
      <span className="text-base font-bold tracking-tight">GitMetro</span>
    </span>
  );
}
