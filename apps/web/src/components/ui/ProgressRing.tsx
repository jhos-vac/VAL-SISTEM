"use client";

import { useEffect, useState } from "react";

const TONES = {
  primary: "var(--primary)",
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
} as const;

// Anillo de progreso animado (se llena al aparecer). El porcentaje va
// escrito en el centro: el color nunca es la única señal.
export function ProgressRing({
  value,
  label,
  tone = "primary",
  size = 72,
}: {
  value: number; // 0..1
  label: string;
  tone?: keyof typeof TONES;
  size?: number;
}) {
  const [shown, setShown] = useState(0);
  const clamped = Math.min(1, Math.max(0, value));
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.round(clamped * 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "var(--surface-raised)" }} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={TONES[tone]}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-mono)] text-sm font-semibold tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
