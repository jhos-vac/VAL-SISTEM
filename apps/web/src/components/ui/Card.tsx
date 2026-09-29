const ACCENTS = {
  primary: "bg-primary",
  gain: "bg-status-good",
  loss: "bg-status-critical",
  none: "",
} as const;

export function Card({
  title,
  action,
  accent = "none",
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  accent?: keyof typeof ACCENTS;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-hairline bg-surface">
      {accent !== "none" ? <div className={`h-[3px] w-full ${ACCENTS[accent]}`} /> : null}
      <div className="p-4">
        {title ? (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-secondary">{title}</h2>
            {action}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
