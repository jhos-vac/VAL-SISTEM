// Tipos compartidos entre web y móvil, alineados con los 4 dominios del
// backend (Identity, Market, Portfolio, Automation). Ver
// Especificacion_Web_Movil_MVP.md y Estado_Backend_VAL-BACKEND.md.

export type Currency = 'USD' | 'EUR' | string;

// Alineado 1:1 con el PublicUser que devuelve VAL-BACKEND
// (src/auth/auth.service.ts) — nunca incluye passwordHash. Los campos de
// preferencias (moneda base, idioma, tema) todavía no existen en el
// backend (dependen de los catálogos Language/Currencie/Timezone, sin
// seed todavía — ver Estado_Backend_VAL-BACKEND.md), así que no están
// acá; se agregan cuando el endpoint de settings exista de verdad.
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  emailVerified: boolean;
  status: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  // El refresh token nunca vive en este objeto en memoria del cliente:
  // en web va en cookie httpOnly, en móvil en almacenamiento seguro.
}

export type SyncStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ExchangeAccount {
  id: string;
  exchange: 'binance' | 'bybit' | 'kraken';
  label: string;
  apiKeyLast4: string;
  status: SyncStatus;
  lastSyncedAt: string | null;
}

export interface Portfolio {
  id: string;
  name: string;
  isDefault: boolean;
  baseCurrency: Currency;
}

export interface PortfolioSummary {
  portfolioId: string;
  totalValue: number;
  totalInvested: number;
  realizedPnl: number;
  unrealizedPnl: number;
  changePercent24h: number;
  asOf: string;
}

export interface AssetAllocation {
  assetSymbol: string;
  assetName: string;
  valueInBaseCurrency: number;
  percentage: number;
}

export interface PerformancePoint {
  date: string;
  totalValue: number;
}

export interface AssetPosition {
  id: string;
  portfolioId: string;
  walletId: string;
  assetSymbol: string;
  assetName: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  currentValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
}

export type TransactionType = 'buy' | 'sell' | 'transfer_in' | 'transfer_out';

export interface Transaction {
  id: string;
  portfolioId: string;
  assetSymbol: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fee: number;
  notes?: string;
  executedAt: string;
  source: 'manual' | 'sync';
}

export interface MarketTicker {
  assetSymbol: string;
  assetName: string;
  price: number;
  changePercent24h: number;
}
