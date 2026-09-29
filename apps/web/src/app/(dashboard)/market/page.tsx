"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { PnlValue } from "@/components/ui/PnlValue";
import { formatCurrency } from "@val-sistem/shared";
import { fetchTickers } from "@/lib/market-client";

// RFW-09: precio actual y variación 24h de los activos en portafolio/watchlist.
// Datos reales del módulo Market (ver VAL-BACKEND/src/market/market.controller.ts) —
// requiere que el backend tenga el catálogo poblado (npm run db:seed:market,
// que ya corre solo como parte de npm run dev) y el sync de tickers haya
// corrido al menos una vez (arranca automático al levantar el backend).
export default function MarketPage() {
  const { data: tickers, isLoading, isError } = useQuery({
    queryKey: ["market", "tickers"],
    queryFn: () => fetchTickers(),
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Mercado</h1>
      <Card>
        {isLoading ? (
          <p className="py-4 text-sm text-text-secondary">Cargando precios…</p>
        ) : isError ? (
          <p className="py-4 text-sm text-text-secondary">
            No se pudieron cargar los precios. Verificá que el backend esté corriendo.
          </p>
        ) : !tickers || tickers.length === 0 ? (
          <p className="py-4 text-sm text-text-secondary">
            Todavía no hay precios sincronizados. Esperá a que corra el primer sync
            (automático al levantar el backend) o disparalo a mano: POST /market/sync/tickers.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2 font-normal">Activo</th>
                <th className="py-2 font-normal text-right">Precio</th>
                <th className="py-2 font-normal text-right">Variación 24h</th>
              </tr>
            </thead>
            <tbody>
              {tickers.map((t) => (
                <tr key={t.assetSymbol} className="border-t border-border-hairline">
                  <td className="py-2">
                    <span className="font-medium">{t.assetSymbol}</span>{" "}
                    <span className="text-text-secondary">{t.assetName}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(t.price)}</td>
                  <td className="py-2 text-right">
                    <PnlValue value={t.changePercent24h} asPercent />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
