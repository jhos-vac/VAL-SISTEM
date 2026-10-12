import { useQuery } from '@tanstack/react-query';
import type { Portfolio } from '@val-sistem/shared';
import { ALL_PORTFOLIOS_ID, fetchPortfolios } from '@/lib/clients';
import { usePortfolioSelection } from '@/store/portfolio';

// Mismas reglas que la web (useDefaultPortfolio): la elección explícita,
// si no el predeterminado, si no el primero. La vista "General" suma todos
// los portafolios y solo existe con 2 o más.
export function resolveActivePortfolio(
  portfolios: Portfolio[] | undefined,
  activePortfolioId: string | null,
): { portfolio: Portfolio | null; isAggregate: boolean; canAggregate: boolean } {
  const list = portfolios ?? [];
  const canAggregate = list.length >= 2;
  const isAggregate = activePortfolioId === ALL_PORTFOLIOS_ID && canAggregate;
  const selected = activePortfolioId
    ? list.find((p) => p.id === activePortfolioId)
    : undefined;
  const real = selected ?? list.find((p) => p.isDefault) ?? list[0] ?? null;
  const portfolio =
    isAggregate && real
      ? {
          id: ALL_PORTFOLIOS_ID,
          name: 'General (todos)',
          isDefault: false,
          baseCurrency: real.baseCurrency,
        }
      : real;
  return { portfolio, isAggregate, canAggregate };
}

export function useActivePortfolio() {
  const query = useQuery({ queryKey: ['portfolios'], queryFn: fetchPortfolios });
  const activePortfolioId = usePortfolioSelection((s) => s.activePortfolioId);
  return {
    ...resolveActivePortfolio(query.data, activePortfolioId),
    portfolios: query.data ?? [],
    hasNone: query.isSuccess && query.data.length === 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}
