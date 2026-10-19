// Endpoints del backend que usa la app (mismo contrato que
// apps/web/src/lib/*-client.ts).
import type {
  AssetAllocation,
  AssetPosition,
  ExchangeAccount,
  MarketTicker,
  PerformancePoint,
  Portfolio,
  PortfolioSummary,
  Transaction,
  TransactionType,
  User,
} from '@val-sistem/shared';
import { request } from './api';
import { requestWithAuth } from './session';

// --- Portfolio ---

export const fetchPortfolios = () => requestWithAuth<Portfolio[]>('/portfolios');

export interface PortfolioInput {
  name: string;
  baseCurrency: string;
  isDefault?: boolean;
}

export const createPortfolio = (input: PortfolioInput) =>
  requestWithAuth<Portfolio>('/portfolios', { method: 'POST', body: JSON.stringify(input) });

export const updatePortfolio = (id: string, input: Partial<PortfolioInput>) =>
  requestWithAuth<Portfolio>(`/portfolios/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

// Publicación en el ranking de Explorar: solo % de rendimiento y
// composición, con un alias; nunca montos ni datos del usuario.
export const setPublication = (id: string, input: { isPublic: boolean; alias?: string }) =>
  requestWithAuth<Portfolio>(`/portfolios/${id}/publication`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const fetchSummary = (portfolioId: string) =>
  requestWithAuth<PortfolioSummary>(`/portfolios/${portfolioId}/summary`);

export const fetchAllocation = (portfolioId: string) =>
  requestWithAuth<AssetAllocation[]>(`/portfolios/${portfolioId}/allocation`);

export const fetchPerformance = (portfolioId: string) =>
  requestWithAuth<PerformancePoint[]>(`/portfolios/${portfolioId}/performance`);

export const fetchPositions = (portfolioId: string) =>
  requestWithAuth<AssetPosition[]>(`/positions?portfolioId=${portfolioId}`);

export interface TransactionFilters {
  portfolioId: string;
  type?: TransactionType;
  assetSymbol?: string;
  from?: string;
  // Las monedas capital (USDT…) se ocultan salvo que se pidan.
  includeCapital?: boolean;
}

export function fetchTransactions(filters: TransactionFilters) {
  const params = new URLSearchParams({ portfolioId: filters.portfolioId });
  if (filters.type) params.set('type', filters.type);
  if (filters.assetSymbol) params.set('assetSymbol', filters.assetSymbol);
  if (filters.from) params.set('from', filters.from);
  if (filters.includeCapital) params.set('includeCapital', 'true');
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

export const createTransaction = (input: CreateTransactionInput) =>
  requestWithAuth<Transaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export interface Wallet {
  id: string;
  portfolioId: string;
  walletName: string;
  walletType: string;
  isActive: boolean;
}

export const fetchWallets = (portfolioId: string) =>
  requestWithAuth<Wallet[]>(`/portfolios/${portfolioId}/wallets`);

// Igual que la web: el alta manual va a una wallet "manual"; si el
// portafolio no tiene ninguna, se crea "Principal".
export async function getOrCreateManualWallet(portfolioId: string): Promise<Wallet> {
  const wallets = await fetchWallets(portfolioId);
  const manual = wallets.find((w) => w.walletType === 'manual');
  if (manual) return manual;
  return requestWithAuth<Wallet>(`/portfolios/${portfolioId}/wallets`, {
    method: 'POST',
    body: JSON.stringify({ walletName: 'Principal', walletType: 'manual' }),
  });
}

// --- Market (público) ---

export const fetchTickers = () => request<MarketTicker[]>('/market/tickers');

// --- Exchange ---

export const fetchExchangeAccounts = () =>
  requestWithAuth<ExchangeAccount[]>('/exchange-accounts');

export interface ConnectExchangeInput {
  label: string;
  apiKey: string;
  apiSecret: string;
}

export interface ConnectExchangeResponse extends ExchangeAccount {
  warning?: string;
  syncMessage: string;
}

export const connectExchangeAccount = (input: ConnectExchangeInput) =>
  requestWithAuth<ConnectExchangeResponse>('/exchange-accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export interface SyncResult {
  // 'skipped': ya había un sync en curso para esa cuenta.
  status: 'completed' | 'failed' | 'skipped';
  recordsProcessed: number;
  message: string;
}

export const disconnectExchangeAccount = (id: string) =>
  requestWithAuth(`/exchange-accounts/${id}`, { method: 'DELETE' });

export const syncExchangeAccount = (id: string) =>
  requestWithAuth<SyncResult>(`/exchange-accounts/${id}/sync`, { method: 'POST' });

// --- Usuario ---

export const fetchProfile = () => requestWithAuth<User>('/auth/me');

export type ThemePreference = 'system' | 'light' | 'dark';

export interface UserSettings {
  language: string;
  currency: string;
  timezone: string;
  theme: ThemePreference;
  notificationsEnabled: boolean;
  biometricEnabled: boolean;
}

export interface SettingsCatalogs {
  languages: { code: string; name: string; nativeName: string }[];
  currencies: { code: string; symbol: string; name: string }[];
  timezones: { name: string; utcOffset: string }[];
}

export const fetchSettingsCatalogs = () => requestWithAuth<SettingsCatalogs>('/users/settings/catalogs');

export const updateProfile = (input: { firstName?: string; lastName?: string; username?: string }) =>
  requestWithAuth<User>('/users/me', { method: 'PATCH', body: JSON.stringify(input) });

export const fetchSettings = () => requestWithAuth<UserSettings>('/users/me/settings');

export const updateSettings = (input: Partial<UserSettings>) =>
  requestWithAuth<UserSettings>('/users/me/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

// --- Dispositivos ---

export interface RegisterDeviceInput {
  deviceName: string;
  platform: 'ios' | 'android';
  os: string;
  appVersion: string;
  pushToken: string;
}

export const registerDevice = (input: RegisterDeviceInput) =>
  requestWithAuth<{ id: string }>('/devices', {
    method: 'POST',
    body: JSON.stringify(input),
  });
