// Endpoints de seguimiento por compra, metas, estrategias y portafolios
// públicos (mismo contrato que apps/web/src/lib/strategy-client.ts).
import type {
  AssetLots,
  DcaFrequency,
  DcaPlan,
  Goal,
  GoalKind,
  Portfolio,
  PublicPortfolio,
  RebalancePlan,
} from '@val-sistem/shared';
import { request } from './api';
import { requestWithAuth } from './session';

// --- Catálogo y monedas capital ---

export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
}

export const fetchAssets = () => request<MarketAsset[]>('/market/assets');

export const fetchCapitalAssets = () => requestWithAuth<string[]>('/capital-assets');

export const updateCapitalAssets = (symbols: string[]) =>
  requestWithAuth<string[]>('/capital-assets', { method: 'PUT', body: JSON.stringify({ symbols }) });

// --- Rendimiento por compra (lotes) ---

export function fetchLots(portfolioId: string, assetSymbol?: string) {
  const params = new URLSearchParams({ portfolioId });
  if (assetSymbol) params.set('assetSymbol', assetSymbol);
  return requestWithAuth<AssetLots[]>(`/positions/lots?${params.toString()}`);
}

// --- Metas ---

export interface CreateGoalInput {
  name: string;
  kind: GoalKind;
  targetValue?: number;
  targetPercent?: number;
  deadline?: string;
  assetSymbol?: string;
}

export const fetchGoals = (portfolioId: string) =>
  requestWithAuth<Goal[]>(`/portfolios/${portfolioId}/goals`);

export const createGoal = (portfolioId: string, input: CreateGoalInput) =>
  requestWithAuth<Goal>(`/portfolios/${portfolioId}/goals`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const deleteGoal = (goalId: string) =>
  requestWithAuth(`/goals/${goalId}`, { method: 'DELETE' });

// --- Estrategia ---

export const fetchTargetAllocation = (portfolioId: string) =>
  requestWithAuth<RebalancePlan>(`/portfolios/${portfolioId}/target-allocation`);

export const saveTargetAllocation = (
  portfolioId: string,
  items: { assetSymbol: string; targetPercent: number }[],
) =>
  requestWithAuth<RebalancePlan>(`/portfolios/${portfolioId}/target-allocation`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });

export interface CreateDcaPlanInput {
  assetSymbol: string;
  amount: number;
  frequency: DcaFrequency;
  startDate: string;
  endDate?: string;
}

export const fetchDcaPlans = (portfolioId: string) =>
  requestWithAuth<DcaPlan[]>(`/portfolios/${portfolioId}/dca-plans`);

export const createDcaPlan = (portfolioId: string, input: CreateDcaPlanInput) =>
  requestWithAuth<DcaPlan>(`/portfolios/${portfolioId}/dca-plans`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateDcaPlan = (planId: string, input: { isActive?: boolean }) =>
  requestWithAuth<DcaPlan>(`/dca-plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteDcaPlan = (planId: string) =>
  requestWithAuth(`/dca-plans/${planId}`, { method: 'DELETE' });

// --- Portafolios públicos ---

export const fetchPublicRanking = () => requestWithAuth<PublicPortfolio[]>('/public-portfolios');

export const fetchPublicPortfolio = (id: string) =>
  requestWithAuth<PublicPortfolio>(`/public-portfolios/${id}`);

export const copyPublicPortfolio = (id: string, name: string) =>
  requestWithAuth<Portfolio>(`/public-portfolios/${id}/copy`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
