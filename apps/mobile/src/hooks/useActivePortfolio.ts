import { useQuery } from '@tanstack/react-query';
import { resolveActivePortfolio } from '@val-sistem/shared';
import { fetchPortfolios } from '@/lib/clients';
import { usePortfolioSelection } from '@/store/portfolio';

// Mismas reglas que la web: ver resolveActivePortfolio en @val-sistem/shared.
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
