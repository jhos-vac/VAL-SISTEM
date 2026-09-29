"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPortfolios } from "@/lib/portfolio-client";
import { usePortfolioSelectionStore } from "@/store/portfolio-selection-store";

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

  const selected = activePortfolioId
    ? query.data?.find((p) => p.id === activePortfolioId)
    : undefined;
  const portfolio = selected ?? query.data?.find((p) => p.isDefault) ?? query.data?.[0] ?? null;

  return {
    portfolio,
    hasNone: query.isSuccess && (query.data?.length ?? 0) === 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
