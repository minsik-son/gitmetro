export function TerminalLine({
  children,
  dim = false,
}: {
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div
      className={`whitespace-pre font-mono text-[12px] leading-[1.7] ${
        dim ? "text-muted" : "text-text"
      }`}
    >
      {children}
    </div>
  );
}
