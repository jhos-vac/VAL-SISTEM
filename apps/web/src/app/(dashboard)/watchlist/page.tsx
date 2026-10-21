"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, type WatchlistItem } from "@val-sistem/shared";
import { Card } from "@/components/ui/Card";
import { PnlValue } from "@/components/ui/PnlValue";
import { AssetPicker } from "@/components/strategy/AssetPicker";
import { addToWatchlist, fetchWatchlist, removeFromWatchlist } from "@/lib/alerts-client";

// Lista de seguimiento: monedas que sigues aunque no las tengas, con su
// precio y un acceso directo para crear un aviso.
export default function WatchlistPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["watchlist"], queryFn: fetchWatchlist });
  const setData = (items: WatchlistItem[]) => queryClient.setQueryData(["watchlist"], items);
  const add = useMutation({ mutationFn: addToWatchlist, onSuccess: setData });
  const remove = useMutation({ mutationFn: removeFromWatchlist, onSuccess: setData });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Seguimiento</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Monedas que quieres seguir de cerca, aunque todavía no las tengas.
        </p>
      </div>

      <Card>
        <AssetPicker
          label="Agregar una moneda"
          held={[]}
          exclude={(data ?? []).map((i) => i.assetSymbol)}
          onPick={(symbol) => add.mutate(symbol)}
        />
        {add.isError ? <p className="mt-2 text-sm text-status-critical">{add.error.message}</p> : null}
      </Card>

      <Card>
        {isLoading ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-text-secondary">Todavía no sigues ninguna moneda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th className="py-2 font-normal">Moneda</th>
                  <th className="py-2 text-right font-normal">Precio</th>
                  <th className="py-2 text-right font-normal">24 h</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {data.map((i) => (
                  <tr key={i.assetSymbol} className="border-t border-border-hairline">
                    <td className="py-2.5">
                      <div className="font-medium">{i.assetSymbol}</div>
                      <div className="text-xs text-text-secondary">{i.assetName}</div>
                    </td>
                    <td className="py-2.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
                      {i.price !== null ? formatCurrency(i.price, "USD") : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      {i.changePercent24h !== null ? <PnlValue value={i.changePercent24h} asPercent /> : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-3 text-xs">
                        <Link href={`/alerts?asset=${i.assetSymbol}&from=watchlist`} className="text-primary">
                          Crear aviso
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove.mutate(i.assetSymbol)}
                          className="text-text-secondary hover:text-status-critical"
                        >
                          Quitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
