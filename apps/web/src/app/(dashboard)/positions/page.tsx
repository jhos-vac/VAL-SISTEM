"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { PnlValue } from "@/components/ui/PnlValue";
import { formatCurrency, formatQuantity } from "@val-sistem/shared";
import type { AssetPosition } from "@val-sistem/shared";
import { fetchPositions, fetchWallets, type Wallet } from "@/lib/portfolio-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";

// RFW-06: posiciones por activo (cantidad, costo promedio, valor actual,
// ganancia realizada/no realizada), agrupadas por wallet.
export default function PositionsPage() {
  const { portfolio, hasNone, isLoading: loadingPortfolio } = useDefaultPortfolio();

  const { data: positions, isLoading } = useQuery({
    queryKey: ["positions", portfolio?.id],
    queryFn: () => fetchPositions(portfolio!.id),
    enabled: !!portfolio,
  });

  const { data: wallets, isLoading: loadingWallets } = useQuery({
    queryKey: ["wallets", portfolio?.id],
    queryFn: () => fetchWallets(portfolio!.id),
    enabled: !!portfolio,
  });

  const walletNameById = new Map<string, Wallet>((wallets ?? []).map((w) => [w.id, w]));

  const groups = groupPositionsByWallet(positions ?? [], walletNameById);

  const busy = loadingPortfolio || isLoading || loadingWallets;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Posiciones</h1>

      {busy ? (
        <Card>
          <p className="py-4 text-sm text-text-secondary">Cargando…</p>
        </Card>
      ) : hasNone ? (
        <Card>
          <p className="py-4 text-sm text-text-secondary">
            Todavía no tenés portafolios.{" "}
            <Link href="/portfolios" className="text-primary">
              Creá el primero
            </Link>
            .
          </p>
        </Card>
      ) : !positions || positions.length === 0 ? (
        <Card>
          <p className="py-4 text-sm text-text-secondary">
            Sin posiciones todavía —{" "}
            <Link href="/transactions/new" className="text-primary">
              registrá tu primera operación
            </Link>
            .
          </p>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.walletId}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">{group.walletLabel}</h2>
              <span className="text-xs text-text-secondary">
                {group.positions.length}{" "}
                {group.positions.length === 1 ? "posición" : "posiciones"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-text-secondary">
                    <th className="py-2 font-normal">Activo</th>
                    <th className="py-2 font-normal text-right">Cantidad</th>
                    <th className="py-2 font-normal text-right">Costo prom.</th>
                    <th className="py-2 font-normal text-right">Precio actual</th>
                    <th className="py-2 font-normal text-right">Valor</th>
                    <th className="py-2 font-normal text-right">Ganancia no realizada</th>
                  </tr>
                </thead>
                <tbody>
                  {group.positions.map((pos) => (
                    <tr key={pos.id} className="border-t border-border-hairline">
                      <td className="py-2 font-medium">{pos.assetSymbol}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatQuantity(pos.quantity)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(pos.averageCost)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(pos.currentPrice)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(pos.currentValue)}
                      </td>
                      <td className="py-2 text-right">
                        <PnlValue value={pos.unrealizedPnl} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

interface PositionGroup {
  walletId: string;
  walletLabel: string;
  positions: AssetPosition[];
}

function groupPositionsByWallet(
  positions: AssetPosition[],
  walletNameById: Map<string, Wallet>,
): PositionGroup[] {
  const byWallet = new Map<string, AssetPosition[]>();
  for (const pos of positions) {
    const list = byWallet.get(pos.walletId) ?? [];
    list.push(pos);
    byWallet.set(pos.walletId, list);
  }

  const groups: PositionGroup[] = [];
  for (const [walletId, list] of byWallet) {
    const wallet = walletNameById.get(walletId);
    groups.push({
      walletId,
      // Wallet eliminada u otra inconsistencia: mostramos un id truncado
      // en vez de ocultar la posición.
      walletLabel: wallet ? wallet.walletName : `Wallet ${walletId.slice(0, 8)}…`,
      positions: list,
    });
  }

  groups.sort((a, b) => a.walletLabel.localeCompare(b.walletLabel));
  return groups;
}
