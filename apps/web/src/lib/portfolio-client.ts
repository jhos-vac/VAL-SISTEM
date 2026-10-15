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
  // Las monedas capital (USDT…) se ocultan salvo que se pidan.
  includeCapital?: boolean;
}

export function fetchTransactions(filters: TransactionFilters): Promise<Transaction[]> {
  const params = new URLSearchParams({ portfolioId: filters.portfolioId });
  if (filters.assetSymbol) params.set("assetSymbol", filters.assetSymbol);
  if (filters.type) params.set("type", filters.type);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.includeCapital) params.set("includeCapital", "true");
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

// El concepto de "wallet" queda oculto al usuario: el alta manual va a la
// primera wallet manual del portafolio, o se crea "Principal". Nunca a una
// wallet de exchange (Binance): esas se reconstruyen en cada sync y el
// movimiento se perdería (el backend además lo rechaza).
export async function getOrCreateDefaultWallet(portfolioId: string): Promise<Wallet> {
  const wallets = await fetchWallets(portfolioId);
  const manual = wallets.find((w) => w.walletType === "manual");
  if (manual) return manual;
  return createWallet(portfolioId, { walletName: "Principal", walletType: "manual" });
}

// Monedas capital (p.ej. USDT como dólares virtuales): suman al valor
// total pero no cuentan en invertido, ganancias ni variación 24h. Es una
// preferencia del usuario, igual para todos sus portafolios.
export function fetchCapitalAssets(): Promise<string[]> {
  return requestWithAuth<string[]>("/capital-assets");
}

export function updateCapitalAssets(symbols: string[]): Promise<string[]> {
  return requestWithAuth<string[]>("/capital-assets", {
    method: "PUT",
    body: JSON.stringify({ symbols }),
  });
}
