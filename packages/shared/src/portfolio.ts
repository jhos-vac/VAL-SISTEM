import type { Portfolio, TransactionType } from './types';

// Id de la vista "General": suma de todos los portafolios del usuario. El
// backend lo acepta en los endpoints de lectura igual que un id real.
export const ALL_PORTFOLIOS_ID = 'all';

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  buy: 'Compra',
  sell: 'Venta',
  transfer_in: 'Transferencia entrante',
  transfer_out: 'Transferencia saliente',
};

export interface ActivePortfolio {
  portfolio: Portfolio | null;
  isAggregate: boolean;
  canAggregate: boolean;
}

// Portafolio activo de la app (web y móvil): la elección explícita del
// usuario; si no, el predeterminado; si no, el primero. Si la elección ya no
// existe (se borró), cae al predeterminado. La vista General solo existe con
// 2 o más portafolios.
export function resolveActivePortfolio(
  portfolios: Portfolio[] | undefined,
  activePortfolioId: string | null,
): ActivePortfolio {
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
