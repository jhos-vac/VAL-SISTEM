// Cliente del módulo Market de VAL-BACKEND (ver
// VAL-BACKEND/src/market/market.controller.ts). Los endpoints de precios
// son públicos (no requieren sesión) — mismo dato para todos los
// usuarios, igual que en Binance — así que usa `request()` directo en
// vez de `requestWithAuth()`.

import { request } from "./api-client";
import type { MarketTicker } from "@val-sistem/shared";

export async function fetchTickers(symbols?: string[]): Promise<MarketTicker[]> {
  const query = symbols?.length ? `?symbols=${symbols.join(",")}` : "";
  return request<MarketTicker[]>(`/market/tickers${query}`);
}

export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  logoUrl: string;
  category: string;
  isActive: boolean;
}

export async function fetchAssets(): Promise<MarketAsset[]> {
  return request<MarketAsset[]>("/market/assets");
}
