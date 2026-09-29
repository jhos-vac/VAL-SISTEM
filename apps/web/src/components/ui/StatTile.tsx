const ACCENTS = {
  primary: "bg-primary",
  gain: "bg-status-good",
  loss: "bg-status-critical",
  none: "",
} as const;

export function StatTile({
  label,
  value,
  delta,
  accent = "none",
}: {
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  accent?: keyof typeof ACCENTS;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-hairline bg-surface">
      {accent !== "none" ? <div className={`h-[3px] w-full ${ACCENTS[accent]}`} /> : null}
      <div className="p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
        <p className="mt-2 font-[family-name:var(--font-mono)] text-2xl font-semibold tabular-nums">
          {value}
        </p>
        {delta ? <div className="mt-1 text-sm text-text-secondary">{delta}</div> : null}
      </div>
    </div>
  );
}
