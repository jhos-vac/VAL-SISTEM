"use client";

import { useEffect, useState } from "react";
import { formatCurrency, type RebalancePlan } from "@val-sistem/shared";
import { colorFor, TradeHint } from "./TargetAllocationEditor";
import { colorOrder } from "@val-sistem/shared";

// Vista de la estrategia guardada: por activo, una barra con el % actual y
// una marca en el % objetivo, con la diferencia y qué hacer. Las barras se
// animan al entrar.
export function AllocationView({ plan, currency }: { plan: RebalancePlan; currency: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const order = colorOrder(plan);
  const targeted = plan.rows.filter((r) => r.targetPercent !== null && r.targetPercent > 0);
  const maxPercent = Math.max(
    10,
    ...plan.rows.map((r) => Math.max(r.currentPercent, r.targetPercent ?? 0)),
  );
  const scale = (p: number) => `${mounted ? (p / maxPercent) * 100 : 0}%`;
  const offTarget = plan.rows.filter((r) => r.suggestedTrade !== null && Math.abs(r.suggestedTrade) >= 1);

  return (
    <div className="flex flex-col gap-5">
      {/* Objetivo como barra apilada */}
      <div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
          {targeted.map((r) => (
            <div
              key={r.assetSymbol}
              className="h-full transition-[width] duration-700 ease-out"
              style={{
                width: mounted ? `${r.targetPercent}%` : "0%",
                backgroundColor: colorFor(r.assetSymbol, order),
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
          {targeted.map((r) => (
            <span key={r.assetSymbol} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(r.assetSymbol, order) }} />
              {r.assetSymbol} {r.targetPercent?.toFixed(1)} %
            </span>
          ))}
          {plan.targetsSum < 99.99 ? <span>Libre {(100 - plan.targetsSum).toFixed(1)} %</span> : null}
        </div>
      </div>

      {/* Actual vs objetivo por activo */}
      <ul className="flex flex-col gap-4">
        {plan.rows.map((r) => {
          const color = colorFor(r.assetSymbol, order);
          return (
            <li key={r.assetSymbol}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{r.assetSymbol}</span>
                <span className="text-xs text-text-secondary tabular-nums">
                  hoy {r.currentPercent.toFixed(1)} %
                  {r.targetPercent !== null ? ` · objetivo ${r.targetPercent.toFixed(1)} %` : " · sin objetivo"}
                  {r.diffPercent !== null && Math.abs(r.diffPercent) >= 0.1
                    ? ` (${r.diffPercent > 0 ? "+" : ""}${r.diffPercent.toFixed(1)} pts)`
                    : ""}
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5 w-full rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: scale(r.currentPercent), backgroundColor: color, opacity: 0.85 }}
                />
                {r.targetPercent !== null ? (
                  <div
                    className="absolute -top-1 w-0.5 rounded bg-foreground transition-[left] duration-700 ease-out"
                    style={{ left: scale(r.targetPercent), height: "18px" }}
                    title={`Objetivo ${r.targetPercent.toFixed(1)} %`}
                  />
                ) : null}
              </div>
              <div className="mt-1 text-right text-xs">
                {r.suggestedTrade === null ? (
                  <span className="text-text-muted">queda en lo libre</span>
                ) : (
                  <TradeHint trade={r.suggestedTrade} currency={currency} />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-text-muted">
        {offTarget.length === 0
          ? "Tu portafolio está alineado con la estrategia."
          : `${offTarget.length} activo(s) fuera de objetivo.`}{" "}
        Sobre un valor total de {formatCurrency(plan.totalValue, currency)}. La línea vertical marca el
        objetivo.
      </p>
    </div>
  );
}
