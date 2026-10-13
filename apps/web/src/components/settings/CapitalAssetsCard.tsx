"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { fetchAssets } from "@/lib/market-client";
import {
  fetchCapitalAssets,
  fetchPositions,
  updateCapitalAssets,
} from "@/lib/portfolio-client";
import { ALL_PORTFOLIOS_ID } from "@/hooks/useDefaultPortfolio";

// Stablecoins que se ofrecen aunque el usuario todavía no las tenga.
const SUGGESTED = ["USDT", "USDC", "FDUSD", "DAI"];

// Elección de monedas capital: las que el usuario tiene más las
// stablecoins sugeridas que existan en el catálogo.
export function CapitalAssetsCard() {
  const queryClient = useQueryClient();

  const { data: selected, isLoading } = useQuery({
    queryKey: ["capital-assets"],
    queryFn: fetchCapitalAssets,
  });
  const { data: positions } = useQuery({
    queryKey: ["positions", ALL_PORTFOLIOS_ID],
    queryFn: () => fetchPositions(ALL_PORTFOLIOS_ID),
  });
  const { data: catalog } = useQuery({
    queryKey: ["market-assets"],
    queryFn: fetchAssets,
  });

  const mutation = useMutation({
    mutationFn: updateCapitalAssets,
    onSuccess: async (saved) => {
      queryClient.setQueryData(["capital-assets"], saved);
      // Cambia cómo se calculan resumen, posiciones y rendimiento.
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== "capital-assets",
      });
    },
  });

  const catalogSymbols = new Set((catalog ?? []).map((a) => a.symbol));
  const held = (positions ?? []).map((p) => p.assetSymbol);
  const options = [
    ...new Set([
      ...(selected ?? []),
      ...held,
      ...SUGGESTED.filter((s) => catalogSymbols.has(s)),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const current = mutation.isPending ? (mutation.variables ?? []) : (selected ?? []);

  function toggle(symbol: string) {
    const next = current.includes(symbol)
      ? current.filter((s) => s !== symbol)
      : [...current, symbol];
    mutation.mutate(next);
  }

  return (
    <Card title="Moneda capital">
      <div className="flex max-w-xl flex-col gap-3">
        <p className="text-sm text-text-secondary">
          Marcá las monedas que usás como dinero, no como inversión (por ejemplo USDT, como
          dólares virtuales). Siguen sumando al valor total, pero no cuentan en lo invertido,
          en la ganancia ni en la variación 24h.
        </p>
        {isLoading ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Todavía no tenés monedas para elegir.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Monedas capital">
            {options.map((symbol) => {
              const on = current.includes(symbol);
              return (
                <button
                  key={symbol}
                  type="button"
                  aria-pressed={on}
                  disabled={mutation.isPending}
                  onClick={() => toggle(symbol)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                    on
                      ? "border-primary bg-primary text-white"
                      : "border-border-hairline bg-background text-foreground hover:border-primary"
                  }`}
                >
                  {symbol}
                </button>
              );
            })}
          </div>
        )}
        {mutation.isError ? (
          <p className="text-sm text-status-critical">
            No se pudo guardar: {mutation.error.message}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
