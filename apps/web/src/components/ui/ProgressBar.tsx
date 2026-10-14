// Barra de progreso accesible (role="progressbar" + texto). El color lo da
// el estado, nunca es la única señal: siempre va acompañada del porcentaje.
const TONES = {
  primary: "bg-primary",
  good: "bg-status-good",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
} as const;

export function ProgressBar({
  value,
  label,
  tone = "primary",
}: {
  value: number; // 0..1 (se recorta)
  label: string;
  tone?: keyof typeof TONES;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-raised"
    >
      <div className={`h-full rounded-full ${TONES[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
