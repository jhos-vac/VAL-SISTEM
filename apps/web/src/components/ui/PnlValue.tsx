import { formatCurrency, formatPercent } from "@val-sistem/shared";

// RNFC-04: nunca depender solo del color para ganancia/pérdida — siempre
// signo (+/-) y, aquí, además una flecha, junto al color. Los valores van
// en monoespaciada (JetBrains Mono), igual que el resto de cifras.
export function PnlValue({
  value,
  currency,
  asPercent = false,
}: {
  value: number;
  currency?: string;
  asPercent?: boolean;
}) {
  const isPositive = value >= 0;
  const label = asPercent
    ? formatPercent(value)
    : `${value >= 0 ? "+" : ""}${formatCurrency(value, currency)}`;

  return (
    <span
      className={`inline-flex items-center gap-1 font-[family-name:var(--font-mono)] font-medium tabular-nums ${
        isPositive ? "text-pnl-up" : "text-pnl-down"
      }`}
    >
      <span aria-hidden="true">{isPositive ? "▲" : "▼"}</span>
      {label}
    </span>
  );
}
