"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPortfolios } from "@/lib/portfolio-client";
import { usePortfolioSelectionStore } from "@/store/portfolio-selection-store";
import { ALL_PORTFOLIOS_ID, resolveActivePortfolio } from "@val-sistem/shared";

// Re-export para los imports existentes; la definición vive en shared.
export { ALL_PORTFOLIOS_ID };

// "El" portafolio activo para toda la app: la elección del selector del
// Topbar (RFW-03), si no el predeterminado, si no el primero. Las reglas
// son las mismas que en la app móvil (resolveActivePortfolio, en shared).
export function useDefaultPortfolio() {
  const query = useQuery({
    queryKey: ["portfolios"],
    queryFn: fetchPortfolios,
  });
  const activePortfolioId = usePortfolioSelectionStore((s) => s.activePortfolioId);

  return {
    ...resolveActivePortfolio(query.data, activePortfolioId),
    hasNone: query.isSuccess && (query.data?.length ?? 0) === 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
