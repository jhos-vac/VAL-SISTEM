"use client";

import { useMemo, useState } from "react";
import { formatCurrency, type RebalancePlan } from "@val-sistem/shared";
import { CATEGORICAL } from "@/lib/chart-colors";
import { AssetPicker } from "./AssetPicker";
import {
  colorOrder,
  distributeRemaining,
  equalize,
  fromCurrent,
  liveSuggestions,
  maxFor,
  MAX_TOTAL,
  setPercent,
  totalOf,
  type DraftRow,
} from "./allocation-math";

// Color estable por activo dentro del editor (mismo color en la barra, el
// punto de la fila y la vista de comparación).
export function colorFor(symbol: string, order: string[]): string {
  const i = order.indexOf(symbol);
  return CATEGORICAL[(i < 0 ? order.length : i) % CATEGORICAL.length];
}

export function TargetAllocationEditor({
  plan,
  currency,
  saving,
  error,
  onSave,
  onCancel,
}: {
  plan: RebalancePlan;
  currency: string;
  saving: boolean;
  error: string | null;
  onSave: (rows: DraftRow[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<DraftRow[]>(() => {
    const existing = plan.rows
      .filter((r) => r.targetPercent !== null && r.targetPercent > 0)
      .map((r) => ({ assetSymbol: r.assetSymbol, percent: r.targetPercent ?? 0 }));
    return existing.length > 0 ? existing : fromCurrent(plan);
  });

  const held = useMemo(
    () =>
      plan.rows
        .filter((r) => r.currentValue > 0)
        .sort((a, b) => b.currentValue - a.currentValue)
        .map((r) => ({ symbol: r.assetSymbol, currentPercent: r.currentPercent })),
    [plan],
  );
  const order = useMemo(
    () => colorOrder(plan, rows.map((r) => r.assetSymbol)),
    [plan, rows],
  );

  const total = totalOf(rows);
  const remaining = Math.max(0, Math.round((MAX_TOTAL - total) * 100) / 100);
  const over = total > MAX_TOTAL + 0.001;
  const suggestions = liveSuggestions(plan, rows);
  const bySymbol = new Map(suggestions.map((s) => [s.assetSymbol, s]));
  const leftovers = suggestions.filter(
    (s) => !rows.some((r) => r.assetSymbol === s.assetSymbol),
  );
  const canSave = !over && rows.length > 0 && rows.every((r) => r.percent > 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Barra apilada en vivo + total */}
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            Total{" "}
            <span className={`tabular-nums ${over ? "text-status-critical" : total === MAX_TOTAL ? "text-status-good" : ""}`}>
              {total.toFixed(2)} %
            </span>
          </span>
          <span className="text-text-secondary tabular-nums">
            {over ? "Supera el 100 %" : remaining > 0 ? `Libre: ${remaining.toFixed(2)} %` : "Todo asignado"}
          </span>
        </div>
        <div
          className="mt-2 flex h-4 w-full overflow-hidden rounded-full bg-surface-raised"
          role="img"
          aria-label={`Asignación: ${rows.map((r) => `${r.assetSymbol} ${r.percent}%`).join(", ")}${remaining > 0 ? `, libre ${remaining}%` : ""}`}
        >
          {rows.map((r) => (
            <div
              key={r.assetSymbol}
              title={`${r.assetSymbol} ${r.percent.toFixed(2)} %`}
              className="h-full transition-[width] duration-300 ease-out first:rounded-l-full"
              style={{ width: `${Math.min(r.percent, MAX_TOTAL)}%`, backgroundColor: colorFor(r.assetSymbol, order) }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <QuickButton onClick={() => setRows(equalize(rows))} disabled={rows.length === 0}>
            Igualar
          </QuickButton>
          <QuickButton onClick={() => setRows(distributeRemaining(rows))} disabled={remaining <= 0 || rows.length === 0}>
            Repartir lo que falta
          </QuickButton>
          <QuickButton onClick={() => setRows(fromCurrent(plan))} disabled={held.length === 0}>
            Usar mi composición actual
          </QuickButton>
          <QuickButton onClick={() => setRows([])} disabled={rows.length === 0}>
            Vaciar
          </QuickButton>
        </div>
      </div>

      {/* Filas */}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-hairline p-4 text-center text-sm text-text-secondary">
          Agregá activos para armar tu estrategia.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row, i) => {
            const color = colorFor(row.assetSymbol, order);
            const max = maxFor(rows, i);
            const s = bySymbol.get(row.assetSymbol);
            return (
              <li
                key={row.assetSymbol}
                className="rounded-lg border border-border-hairline bg-background/40 p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                  <span className="w-16 font-medium">{row.assetSymbol}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.5}
                    value={row.percent}
                    onChange={(e) => setRows(setPercent(rows, i, Number(e.target.value)))}
                    aria-label={`Porcentaje objetivo de ${row.assetSymbol}`}
                    className="min-w-[140px] flex-1"
                    style={{ accentColor: color }}
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={max}
                      step={0.5}
                      value={row.percent}
                      onChange={(e) => setRows(setPercent(rows, i, Number(e.target.value)))}
                      aria-label={`Porcentaje de ${row.assetSymbol}`}
                      className="w-20 rounded-md border border-border-hairline bg-background px-2 py-1 text-right tabular-nums"
                    />
                    <span className="text-sm">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    aria-label={`Quitar ${row.assetSymbol}`}
                    className="rounded-md px-2 py-1 text-text-secondary transition-colors hover:bg-status-critical/10 hover:text-status-critical"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap justify-between gap-2 pl-6 text-xs text-text-secondary">
                  <span>
                    Hoy {s ? s.currentPercent.toFixed(1) : "0.0"} %
                  </span>
                  <TradeHint trade={s?.trade ?? null} currency={currency} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {leftovers.length > 0 ? (
        <div className="rounded-lg bg-surface-raised p-3 text-xs text-text-secondary">
          <p className="mb-1 font-medium text-foreground">Fuera de la estrategia</p>
          <ul className="space-y-0.5">
            {leftovers.map((s) => (
              <li key={s.assetSymbol} className="flex justify-between gap-2">
                <span>
                  {s.assetSymbol} · hoy {s.currentPercent.toFixed(1)} %
                </span>
                {s.trade !== null ? (
                  <TradeHint trade={s.trade} currency={currency} />
                ) : (
                  <span>no se toca (queda en lo libre)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <AssetPicker
          held={held}
          exclude={rows.map((r) => r.assetSymbol)}
          disabled={remaining <= 0}
          onPick={(symbol) => setRows([...rows, { assetSymbol: symbol, percent: Math.min(10, remaining) }])}
        />
        {remaining <= 0 && rows.length > 0 ? (
          <span className="text-xs text-text-secondary">Bajá algún % para agregar otro activo.</span>
        ) : null}
      </div>

      {over ? <p className="text-sm text-status-critical">La asignación no puede superar el 100 %.</p> : null}
      {rows.some((r) => r.percent <= 0) ? (
        <p className="text-sm text-status-warning">Hay activos en 0 %: subiles el porcentaje o quitálos.</p>
      ) : null}
      {error ? <p className="text-sm text-status-critical">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(rows)}
          disabled={!canSave || saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar estrategia"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border-hairline px-4 py-2 text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function QuickButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-border-hairline px-3 py-1 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function TradeHint({ trade, currency }: { trade: number | null; currency: string }) {
  if (trade === null || Math.abs(trade) < 1) return <span>en objetivo</span>;
  const amount = formatCurrency(Math.abs(trade), currency);
  return trade > 0 ? (
    <span className="font-medium text-pnl-up">Comprar {amount}</span>
  ) : (
    <span className="font-medium text-pnl-down">Vender {amount}</span>
  );
}
