// Cliente del módulo Portfolio de VAL-BACKEND (ver
// VAL-BACKEND/src/portfolio/*.controller.ts). Todos los endpoints
// requieren sesión (no son @Public()) — siempre via requestWithAuth().

import { requestWithAuth } from "./auth-client";
import type {
  AssetAllocation,
  AssetPosition,
  PerformancePoint,
  Portfolio,
  PortfolioSummary,
  Transaction,
  TransactionType,
} from "@val-sistem/shared";

export interface CreatePortfolioInput {
  name: string;
  description?: string;
  baseCurrency: string;
  isDefault?: boolean;
}

export interface UpdatePortfolioInput {
  name?: string;
  description?: string;
  baseCurrency?: string;
  isDefault?: boolean;
}

export function fetchPortfolios(): Promise<Portfolio[]> {
  return requestWithAuth<Portfolio[]>("/portfolios");
}

export function createPortfolio(input: CreatePortfolioInput): Promise<Portfolio> {
  return requestWithAuth<Portfolio>("/portfolios", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePortfolio(id: string, input: UpdatePortfolioInput): Promise<Portfolio> {
  return requestWithAuth<Portfolio>(`/portfolios/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function setDefaultPortfolio(id: string): Promise<Portfolio> {
  return updatePortfolio(id, { isDefault: true });
}

export function fetchSummary(portfolioId: string): Promise<PortfolioSummary> {
  return requestWithAuth<PortfolioSummary>(`/portfolios/${portfolioId}/summary`);
}

export function fetchAllocation(portfolioId: string): Promise<AssetAllocation[]> {
  return requestWithAuth<AssetAllocation[]>(`/portfolios/${portfolioId}/allocation`);
}

// Rendimiento histórico (RFW-04) — snapshots diarios que genera
// PortfolioSnapshotService en el backend. Un portafolio recién creado (o
// mientras el job todavía no corrió su primera vez) devuelve un array
// vacío — el caller decide cómo mostrar ese caso.
export function fetchPerformance(portfolioId: string): Promise<PerformancePoint[]> {
  return requestWithAuth<PerformancePoint[]>(`/portfolios/${portfolioId}/performance`);
}

export function fetchPositions(portfolioId: string): Promise<AssetPosition[]> {
  return requestWithAuth<AssetPosition[]>(`/positions?portfolioId=${portfolioId}`);
}

export interface TransactionFilters {
  portfolioId: string;
  assetSymbol?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
}

export function fetchTransactions(filters: TransactionFilters): Promise<Transaction[]> {
  const params = new URLSearchParams({ portfolioId: filters.portfolioId });
  if (filters.assetSymbol) params.set("assetSymbol", filters.assetSymbol);
  if (filters.type) params.set("type", filters.type);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return requestWithAuth<Transaction[]>(`/transactions?${params.toString()}`);
}

export interface CreateTransactionInput {
  walletId: string;
  assetSymbol: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fee?: number;
  notes?: string;
  executedAt: string;
}

export function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  return requestWithAuth<Transaction>("/transactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface Wallet {
  id: string;
  portfolioId: string;
  walletName: string;
  walletType: string;
  address: string;
  network: string;
  isActive: boolean;
}

export function fetchWallets(portfolioId: string): Promise<Wallet[]> {
  return requestWithAuth<Wallet[]>(`/portfolios/${portfolioId}/wallets`);
}

function createWallet(
  portfolioId: string,
  input: { walletName: string; walletType: string },
): Promise<Wallet> {
  return requestWithAuth<Wallet>(`/portfolios/${portfolioId}/wallets`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// El MVP es "trackeo manual" (ver Especificacion_Web_Movil_MVP.md §3,
// opción A) — el concepto de "wallet" queda oculto al usuario por ahora,
// no hay UI para gestionarlas todavía. Cada portafolio necesita al menos
// una para poder registrar transacciones (CreateTransactionDto pide
// walletId), así que esta función devuelve la primera activa o crea
// "Principal" si el portafolio todavía no tiene ninguna.
export async function getOrCreateDefaultWallet(portfolioId: string): Promise<Wallet> {
  const wallets = await fetchWallets(portfolioId);
  if (wallets.length > 0) return wallets[0];
  return createWallet(portfolioId, { walletName: "Principal", walletType: "manual" });
}
