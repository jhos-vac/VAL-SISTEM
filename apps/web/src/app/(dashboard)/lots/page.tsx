"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { PnlValue } from "@/components/ui/PnlValue";
import { formatCurrency, formatPercent, formatQuantity } from "@val-sistem/shared";
import type { AssetLots } from "@val-sistem/shared";
import { fetchLots } from "@/lib/strategy-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";

// Rendimiento por compra: cada compra es un lote con su propio precio y su
// propia ganancia. Las ventas consumen los lotes más viejos primero (FIFO).
// Arriba de cada activo, el total agrupado.
export default function LotsPage() {
  // useSearchParams exige un Suspense para el prerender estático.
  return (
    <Suspense fallback={<p className="text-sm text-text-secondary">Cargando…</p>}>
      <LotsContent />
    </Suspense>
  );
}

function LotsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const asset = searchParams.get("asset") ?? "";
  const [showClosed, setShowClosed] = useState(false);
  const { portfolio, isLoading: loadingPortfolio } = useDefaultPortfolio();
  const currency = portfolio?.baseCurrency ?? "USD";

  const { data: all } = useQuery({
    queryKey: ["lots", portfolio?.id],
    queryFn: () => fetchLots(portfolio!.id),
    enabled: !!portfolio,
  });
  const groups = (all ?? []).filter(
    (g) => (!asset || g.assetSymbol === asset) && (showClosed || g.quantity > 0),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Rendimiento por compra</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Cada compra con su precio y su ganancia. Las ventas descuentan primero las compras más
          antiguas.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Activo
          <select
            value={asset}
            onChange={(e) =>
              router.replace(e.target.value ? `/lots?asset=${e.target.value}` : "/lots")
            }
            className="rounded-md border border-border-hairline bg-background px-2 py-1.5"
          >
            <option value="">Todos</option>
            {(all ?? []).map((g) => (
              <option key={g.assetSymbol} value={g.assetSymbol}>
                {g.assetSymbol}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
            className="h-4 w-4"
          />
          Mostrar compras ya vendidas
        </label>
      </div>

      {loadingPortfolio || !all ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : groups.length === 0 ? (
        <Card>
          <p className="text-sm text-text-secondary">No hay compras para mostrar.</p>
        </Card>
      ) : (
        groups.map((g) => (
          <AssetLotsCard key={g.assetSymbol} group={g} currency={currency} showClosed={showClosed} />
        ))
      )}
    </div>
  );
}

function AssetLotsCard({
  group,
  currency,
  showClosed,
}: {
  group: AssetLots;
  currency: string;
  showClosed: boolean;
}) {
  const money = (n: number) => formatCurrency(n, currency);
  const lots = group.lots.filter((l) => showClosed || l.isOpen);
  const totalPercent = group.invested > 0 ? (group.unrealizedPnl / group.invested) * 100 : 0;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">
          {group.assetSymbol}{" "}
          <span className="text-sm font-normal text-text-secondary">{group.assetName}</span>
          {group.isCapital ? (
            <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
              Capital
            </span>
          ) : null}
        </h2>
        <p className="text-sm text-text-secondary">
          Precio actual <span className="tabular-nums text-foreground">{money(group.currentPrice)}</span>
        </p>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Cantidad" value={formatQuantity(group.quantity)} />
        <Stat label="Invertido" value={money(group.invested)} />
        <Stat label="Valor actual" value={money(group.currentValue)} />
        <Stat
          label="Ganancia"
          value={
            group.isCapital ? (
              "—"
            ) : (
              <span className="flex flex-col">
                <PnlValue value={group.unrealizedPnl} currency={currency} />
                <span className="text-xs text-text-secondary">{formatPercent(totalPercent)}</span>
              </span>
            )
          }
        />
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-2 font-normal">Fecha</th>
              <th className="py-2 font-normal">Wallet</th>
              <th className="py-2 text-right font-normal">Comprado</th>
              <th className="py-2 text-right font-normal">Queda</th>
              <th className="py-2 text-right font-normal">Precio de compra</th>
              <th className="py-2 text-right font-normal">Valor actual</th>
              <th className="py-2 text-right font-normal">Ganancia</th>
              <th className="py-2 text-right font-normal">Realizada</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr
                key={lot.id}
                className={`border-t border-border-hairline ${lot.isOpen ? "" : "text-text-muted"}`}
              >
                <td className="py-2">
                  {new Date(lot.openedAt).toLocaleDateString("es-EC")}
                  {lot.source === "transfer_in" ? (
                    <span className="ml-1 text-xs text-text-secondary">(entrada)</span>
                  ) : null}
                </td>
                <td className="py-2">{lot.walletName}</td>
                <td className="py-2 text-right tabular-nums">{formatQuantity(lot.quantity)}</td>
                <td className="py-2 text-right tabular-nums">
                  {lot.isOpen ? formatQuantity(lot.remaining) : "Vendida"}
                </td>
                <td className="py-2 text-right tabular-nums">{money(lot.price)}</td>
                <td className="py-2 text-right tabular-nums">{money(lot.currentValue)}</td>
                <td className="py-2 text-right">
                  {lot.isOpen && !group.isCapital ? (
                    <span className="inline-flex flex-col items-end">
                      <PnlValue value={lot.unrealizedPnl} currency={currency} />
                      <span className="text-xs text-text-secondary">
                        {formatPercent(lot.unrealizedPercent)}
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 text-right">
                  {lot.realizedPnl !== 0 ? <PnlValue value={lot.realizedPnl} currency={currency} /> : "—"}
                </td>
              </tr>
            ))}
            {group.untracked.map((u) => (
              <tr key={`untracked-${u.walletId}`} className="border-t border-border-hairline">
                <td className="py-2 text-text-secondary" colSpan={2}>
                  Sin compra registrada · {u.walletName}
                </td>
                <td className="py-2 text-right">—</td>
                <td className="py-2 text-right tabular-nums">{formatQuantity(u.quantity)}</td>
                <td className="py-2 text-right tabular-nums" title="Costo promedio de la posición">
                  {money(u.averageCost)}*
                </td>
                <td className="py-2 text-right tabular-nums">{money(u.currentValue)}</td>
                <td className="py-2 text-right">—</td>
                <td className="py-2 text-right">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {group.untracked.length > 0 ? (
        <p className="mt-2 text-xs text-text-muted">
          * Saldo sin compra registrada (por ejemplo, depositado en el exchange): se valúa al costo
          promedio de la posición, así que su ganancia es estimada.
        </p>
      ) : null}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="mt-1 font-[family-name:var(--font-mono)] tabular-nums">{value}</dd>
    </div>
  );
}
