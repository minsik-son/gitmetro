"use client";

import { useEffect, useState } from "react";
import { TerminalLine } from "./TerminalLine";

interface Step {
  label: string;
  detail: string;
}

const SPINNER = ["◐", "◓", "◑", "◒"] as const;

interface Props {
  repoLabel: string;
  steps?: Step[];
  onDone?: () => void;
  stepIntervalMs?: number;
}

const DEFAULT_STEPS: Step[] = [
  { label: "Parsing repository URL...", detail: "→ resolved" },
  { label: "Fetching branches...", detail: "→ branches discovered" },
  { label: "Reading commit graph...", detail: "→ commits indexed" },
  { label: "Detecting merge stations...", detail: "→ merge points identified" },
  { label: "Allocating branch lanes...", detail: "→ lanes allocated" },
  { label: "Building metro layout...", detail: "→ rectilinear routing complete" },
];

export function LoadingTerminal({
  repoLabel,
  steps = DEFAULT_STEPS,
  onDone,
  stepIntervalMs = 480,
}: Props) {
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (step >= steps.length) {
      const id = setTimeout(() => onDone?.(), 350);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setStep((s) => s + 1), stepIntervalMs);
    return () => clearTimeout(id);
  }, [step, steps.length, stepIntervalMs, onDone]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 380);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(100, Math.round((step / steps.length) * 100));

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl overflow-hidden rounded-md border border-line bg-panel">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <span className="block h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="block h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="block h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-[11px] text-muted">
            gitmetro@core — analysis
          </span>
          <span className="ml-auto font-mono text-[11px] text-muted">
            PID 4831 · {pct}%
          </span>
        </div>
        <div className="px-4 py-3">
          <TerminalLine dim>$ gitmetro analyze {repoLabel}</TerminalLine>
          {steps.slice(0, step).map((s, idx) => (
            <div key={idx}>
              <TerminalLine>
                <span className="text-[#3dd68c]">✓</span> {s.label}
              </TerminalLine>
              <TerminalLine dim>{`  ${s.detail}`}</TerminalLine>
            </div>
          ))}
          {step < steps.length && (
            <TerminalLine>
              <span className="text-[#3ddbd9]">{SPINNER[tick % SPINNER.length]}</span>{" "}
              {steps[step].label}
            </TerminalLine>
          )}
          {step >= steps.length && (
            <>
              <TerminalLine>
                <span className="text-[#3dd68c]">✓</span> Done.
              </TerminalLine>
              <TerminalLine>
                <span className="text-text">▍</span>
              </TerminalLine>
            </>
          )}
        </div>
        <div className="h-1 w-full bg-panel-alt">
          <div
            className="h-full bg-[#ff5b5b] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
