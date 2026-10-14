// Cliente de seguimiento por compra, metas, estrategias y portafolios
// públicos. Todo requiere sesión (requestWithAuth).
import { requestWithAuth } from "./auth-client";
import type {
  AssetLots,
  DcaFrequency,
  DcaPlan,
  Goal,
  GoalKind,
  Portfolio,
  PublicPortfolio,
  RebalancePlan,
} from "@val-sistem/shared";

// --- Rendimiento por compra (lotes) ---

export function fetchLots(portfolioId: string, assetSymbol?: string): Promise<AssetLots[]> {
  const params = new URLSearchParams({ portfolioId });
  if (assetSymbol) params.set("assetSymbol", assetSymbol);
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

export function fetchGoals(portfolioId: string): Promise<Goal[]> {
  return requestWithAuth<Goal[]>(`/portfolios/${portfolioId}/goals`);
}

export function createGoal(portfolioId: string, input: CreateGoalInput): Promise<Goal> {
  return requestWithAuth<Goal>(`/portfolios/${portfolioId}/goals`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteGoal(goalId: string): Promise<void> {
  await requestWithAuth(`/goals/${goalId}`, { method: "DELETE" });
}

// --- Estrategia: asignación objetivo ---

export function fetchTargetAllocation(portfolioId: string): Promise<RebalancePlan> {
  return requestWithAuth<RebalancePlan>(`/portfolios/${portfolioId}/target-allocation`);
}

export function saveTargetAllocation(
  portfolioId: string,
  items: Array<{ assetSymbol: string; targetPercent: number }>,
): Promise<RebalancePlan> {
  return requestWithAuth<RebalancePlan>(`/portfolios/${portfolioId}/target-allocation`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

// --- Estrategia: compras periódicas (DCA) ---

export interface CreateDcaPlanInput {
  assetSymbol: string;
  amount: number;
  frequency: DcaFrequency;
  startDate: string;
  endDate?: string;
}

export function fetchDcaPlans(portfolioId: string): Promise<DcaPlan[]> {
  return requestWithAuth<DcaPlan[]>(`/portfolios/${portfolioId}/dca-plans`);
}

export function createDcaPlan(portfolioId: string, input: CreateDcaPlanInput): Promise<DcaPlan> {
  return requestWithAuth<DcaPlan>(`/portfolios/${portfolioId}/dca-plans`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDcaPlan(
  planId: string,
  input: { amount?: number; isActive?: boolean },
): Promise<DcaPlan> {
  return requestWithAuth<DcaPlan>(`/dca-plans/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteDcaPlan(planId: string): Promise<void> {
  await requestWithAuth(`/dca-plans/${planId}`, { method: "DELETE" });
}

// --- Portafolios públicos ---

export function setPublication(
  portfolioId: string,
  input: { isPublic: boolean; alias?: string },
): Promise<Portfolio> {
  return requestWithAuth<Portfolio>(`/portfolios/${portfolioId}/publication`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchPublicRanking(): Promise<PublicPortfolio[]> {
  return requestWithAuth<PublicPortfolio[]>("/public-portfolios");
}

export function fetchPublicPortfolio(id: string): Promise<PublicPortfolio> {
  return requestWithAuth<PublicPortfolio>(`/public-portfolios/${id}`);
}

export function copyPublicPortfolio(id: string, name: string): Promise<Portfolio> {
  return requestWithAuth<Portfolio>(`/public-portfolios/${id}/copy`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
