"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  buildReview,
  COST_SOURCE_LABELS,
  formatCurrency,
  formatPercent,
  type ReviewRow,
} from "@val-sistem/shared";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { PnlValue } from "@/components/ui/PnlValue";
import { Segmented } from "@/components/ui/Choice";
import { fetchPositions } from "@/lib/portfolio-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";

type Order = "up" | "down" | "value" | "alpha";

const ORDERS: Array<{ value: Order; label: string }> = [
  { value: "up", label: "Más subieron" },
  { value: "down", label: "Más bajaron" },
  { value: "value", label: "Mayor valor" },
  { value: "alpha", label: "A-Z" },
];

function sortRows(rows: ReviewRow[], order: Order): ReviewRow[] {
  const copy = [...rows];
  if (order === "up") return copy.sort((a, b) => b.changePercent - a.changePercent);
  if (order === "down") return copy.sort((a, b) => a.changePercent - b.changePercent);
  if (order === "value") return copy.sort((a, b) => b.value - a.value);
  return copy.sort((a, b) => a.assetSymbol.localeCompare(b.assetSymbol));
}

// Revisión general: cuánto subió o bajó cada moneda desde su precio de
// compra, que queda fijo (ver acquisition-cost.ts en el backend).
export default function ReviewPage() {
  const { portfolio, isLoading: loadingPortfolio } = useDefaultPortfolio();
  const currency = portfolio?.baseCurrency ?? "USD";
  const money = (n: number) => formatCurrency(n, currency);
  const [order, setOrder] = useState<Order>("up");

  const { data: positions, isLoading } = useQuery({
    queryKey: ["positions", portfolio?.id],
    queryFn: () => fetchPositions(portfolio!.id),
    enabled: !!portfolio,
  });
  const review = useMemo(() => buildReview(positions ?? []), [positions]);
  const rows = useMemo(() => sortRows(review.rows, order), [review.rows, order]);
  const { summary } = review;
  const maxAbs = Math.max(1, ...review.rows.map((r) => Math.abs(r.changePercent)));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Revisión</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Cuánto subió o bajó cada moneda desde tu precio de compra. Ese precio queda fijo: sale de tus
          compras en Binance o, si la moneda llegó por depósito, conversión o tarjeta, del precio que
          tenía en ese momento.
        </p>
      </div>

      {loadingPortfolio || isLoading ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : review.rows.length === 0 ? (
        <Card>
          <p className="text-sm text-text-secondary">Todavía no hay monedas para revisar en este portafolio.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Ganancia o pérdida"
              value={<PnlValue value={summary.pnl} currency={currency} />}
              delta={<PnlValue value={summary.pnlPercent} asPercent />}
              accent={summary.pnl >= 0 ? "gain" : "loss"}
            />
            <StatTile label="Pagaste" value={money(summary.invested)} />
            <StatTile label="Vale hoy" value={money(summary.value)} />
            <StatTile
              label="Subieron / bajaron"
              value={`${summary.up} / ${summary.down}`}
              delta={
                summary.best || summary.worst
                  ? [
                      summary.best ? `Más subió ${summary.best.assetSymbol}` : null,
                      summary.worst ? `más bajó ${summary.worst.assetSymbol}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : undefined
              }
            />
          </div>

          <Card
            title="Por moneda"
            action={<Segmented label="Ordenar" value={order} options={ORDERS} onChange={setOrder} />}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left text-text-secondary">
                    <th className="py-2 font-normal">Moneda</th>
                    <th className="py-2 text-right font-normal">Precio de compra</th>
                    <th className="py-2 text-right font-normal">Precio hoy</th>
                    <th className="w-[200px] py-2 text-center font-normal">Desde la compra</th>
                    <th className="py-2 text-right font-normal">Ganancia</th>
                    <th className="py-2 text-right font-normal">24 h</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const up = r.changePercent >= 0;
                    const width = `${(Math.abs(r.changePercent) / maxAbs) * 50}%`;
                    return (
                      <tr key={r.assetSymbol} className="border-t border-border-hairline align-middle">
                        <td className="py-2.5">
                          <div className="font-medium">{r.assetSymbol}</div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
                            <span className="rounded bg-surface-raised px-1.5 py-0.5">
                              {COST_SOURCE_LABELS[r.costSource]}
                            </span>
                            {r.costFixedAt ? (
                              <span>desde {new Date(r.costFixedAt).toLocaleDateString("es-EC")}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
                          {money(r.buyPrice)}
                        </td>
                        <td className="py-2.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
                          {money(r.currentPrice)}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="relative h-2 flex-1 rounded-full bg-surface-raised" aria-hidden="true">
                              <div className="absolute inset-y-0 left-1/2 w-px bg-border-hairline" />
                              <div
                                className={`absolute inset-y-0 rounded-full ${up ? "left-1/2 bg-status-good" : "right-1/2 bg-status-critical"}`}
                                style={{ width }}
                              />
                            </div>
                            <span className={`w-16 text-right font-medium tabular-nums ${up ? "text-pnl-up" : "text-pnl-down"}`}>
                              {up ? "+" : ""}
                              {formatPercent(r.changePercent).replace(/^\+/, "")}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right">
                          <PnlValue value={r.pnl} currency={currency} />
                        </td>
                        <td className="py-2.5 text-right">
                          <PnlValue value={r.change24h} asPercent />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
