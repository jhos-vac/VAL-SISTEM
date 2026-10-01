"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPortfolios } from "@/lib/portfolio-client";
import { usePortfolioSelectionStore } from "@/store/portfolio-selection-store";

// Id especial de la vista "General": suma de todos los portafolios. El
// backend lo entiende en los endpoints de lectura (resumen, posiciones,
// transacciones, rendimiento), así que las pantallas lo usan igual que
// el id de un portafolio real.
export const ALL_PORTFOLIOS_ID = "all";

// "El" portafolio activo para toda la app: si el usuario eligió uno a
// mano en el selector del Topbar (RFW-03), se respeta esa elección;
// si no, se cae al marcado como predeterminado, o al primero si por
// algún motivo ninguno lo está. Si la selección explícita apunta a un
// portafolio que ya no existe (se borró en otra pestaña, por ejemplo),
// también se cae al default en vez de romper.
export function useDefaultPortfolio() {
  const query = useQuery({
    queryKey: ["portfolios"],
    queryFn: fetchPortfolios,
  });
  const activePortfolioId = usePortfolioSelectionStore((s) => s.activePortfolioId);

  // La vista General solo tiene sentido con 2 o más portafolios.
  const canAggregate = (query.data?.length ?? 0) >= 2;
  const isAggregate = activePortfolioId === ALL_PORTFOLIOS_ID && canAggregate;

  const selected = activePortfolioId
    ? query.data?.find((p) => p.id === activePortfolioId)
    : undefined;
  const realPortfolio =
    selected ?? query.data?.find((p) => p.isDefault) ?? query.data?.[0] ?? null;
  const portfolio =
    isAggregate && realPortfolio
      ? {
          id: ALL_PORTFOLIOS_ID,
          name: "General (todos)",
          isDefault: false,
          baseCurrency: realPortfolio.baseCurrency,
        }
      : realPortfolio;

  return {
    portfolio,
    isAggregate,
    canAggregate,
    hasNone: query.isSuccess && (query.data?.length ?? 0) === 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
