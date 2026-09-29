// Datos de ejemplo para maquetar la UI mientras el backend no tiene
// endpoints de negocio listos (ver Especificacion_Web_Movil_MVP.md §2:
// "se pueden diseñar y maquetar en paralelo, pero no se pueden integrar
// de verdad hasta que existan Identity, Portfolio y el conector de Binance").
// Cuando esos endpoints existan, estas constantes se reemplazan por
// llamadas reales vía react-query + api-client.ts sin tocar los componentes.

import type {
  AssetAllocation,
  AssetPosition,
  ExchangeAccount,
  MarketTicker,
  Portfolio,
  PortfolioSummary,
  PerformancePoint,
  Transaction,
} from "@val-sistem/shared";

export const mockPortfolios: Portfolio[] = [
  { id: "p1", name: "Principal", isDefault: true, baseCurrency: "USD" },
  { id: "p2", name: "Largo plazo", isDefault: false, baseCurrency: "USD" },
];

export const mockSummary: PortfolioSummary = {
  portfolioId: "p1",
  totalValue: 18420.37,
  totalInvested: 15200,
  realizedPnl: 640.12,
  unrealizedPnl: 2580.25,
  changePercent24h: 2.34,
  asOf: new Date().toISOString(),
};

export const mockAllocation: AssetAllocation[] = [
  { assetSymbol: "BTC", assetName: "Bitcoin", valueInBaseCurrency: 9210.5, percentage: 50 },
  { assetSymbol: "ETH", assetName: "Ethereum", valueInBaseCurrency: 4605.09, percentage: 25 },
  { assetSymbol: "SOL", assetName: "Solana", valueInBaseCurrency: 2210.44, percentage: 12 },
  { assetSymbol: "USDT", assetName: "Tether", valueInBaseCurrency: 1289.43, percentage: 7 },
  { assetSymbol: "Otros", assetName: "Otros activos", valueInBaseCurrency: 1104.91, percentage: 6 },
];

function seededPerformance(): PerformancePoint[] {
  const points: PerformancePoint[] = [];
  let value = 15200;
  const now = Date.now();
  for (let i = 365; i >= 0; i--) {
    const drift = Math.sin(i / 9) * 900 + (365 - i) * 12;
    value = 15200 + drift;
    points.push({
      date: new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      totalValue: Math.max(0, Math.round(value * 100) / 100),
    });
  }
  return points;
}

export const mockPerformance: PerformancePoint[] = seededPerformance();

export const mockPositions: AssetPosition[] = [
  {
    id: "pos1",
    portfolioId: "p1",
    walletId: "w1",
    assetSymbol: "BTC",
    assetName: "Bitcoin",
    quantity: 0.142,
    averageCost: 58230,
    currentPrice: 64863,
    currentValue: 9210.5,
    realizedPnl: 120.4,
    unrealizedPnl: 941.9,
  },
  {
    id: "pos2",
    portfolioId: "p1",
    walletId: "w1",
    assetSymbol: "ETH",
    assetName: "Ethereum",
    quantity: 1.85,
    averageCost: 2380,
    currentPrice: 2489.24,
    currentValue: 4605.09,
    realizedPnl: 210.5,
    unrealizedPnl: 202.1,
  },
  {
    id: "pos3",
    portfolioId: "p1",
    walletId: "w2",
    assetSymbol: "SOL",
    assetName: "Solana",
    quantity: 14.2,
    averageCost: 138.5,
    currentPrice: 155.66,
    currentValue: 2210.44,
    realizedPnl: 0,
    unrealizedPnl: 243.7,
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: "t1",
    portfolioId: "p1",
    assetSymbol: "BTC",
    type: "buy",
    quantity: 0.05,
    price: 61200,
    fee: 3.2,
    executedAt: "2026-09-18T14:22:00Z",
    source: "sync",
  },
  {
    id: "t2",
    portfolioId: "p1",
    assetSymbol: "ETH",
    type: "sell",
    quantity: 0.4,
    price: 2510,
    fee: 1.1,
    notes: "Toma de ganancia parcial",
    executedAt: "2026-09-15T09:05:00Z",
    source: "manual",
  },
  {
    id: "t3",
    portfolioId: "p1",
    assetSymbol: "SOL",
    type: "buy",
    quantity: 5,
    price: 132.4,
    fee: 0.6,
    executedAt: "2026-09-10T11:47:00Z",
    source: "sync",
  },
];

export const mockExchangeAccounts: ExchangeAccount[] = [
  {
    id: "ex1",
    exchange: "binance",
    label: "Binance principal",
    apiKeyLast4: "9F2A",
    status: "completed",
    lastSyncedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  },
];

export const mockTickers: MarketTicker[] = [
  { assetSymbol: "BTC", assetName: "Bitcoin", price: 64863, changePercent24h: 1.8 },
  { assetSymbol: "ETH", assetName: "Ethereum", price: 2489.24, changePercent24h: -0.6 },
  { assetSymbol: "SOL", assetName: "Solana", price: 155.66, changePercent24h: 4.1 },
  { assetSymbol: "USDT", assetName: "Tether", price: 1, changePercent24h: 0 },
];
