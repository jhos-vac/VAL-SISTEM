// Revisión general: por moneda, cuánto subió o bajó desde el precio de
// compra (fijo) y el resumen de todo el portafolio. Las posiciones de la
// misma moneda en varias wallets se suman.
import type { AssetPosition, CostSource } from "./types";

export interface ReviewRow {
  assetSymbol: string;
  assetName: string;
  quantity: number;
  // Precio de compra promedio (fijo) y precio actual, por unidad.
  buyPrice: number;
  currentPrice: number;
  invested: number;
  value: number;
  pnl: number;
  // Cuánto subió (+) o bajó (−) el precio desde la compra, en %.
  changePercent: number;
  change24h: number;
  costSource: CostSource;
  costFixedAt: string | null;
}

export interface ReviewSummary {
  invested: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  up: number;
  down: number;
  best: ReviewRow | null;
  worst: ReviewRow | null;
}

export function buildReview(positions: AssetPosition[]): { rows: ReviewRow[]; summary: ReviewSummary } {
  const bySymbol = new Map<string, AssetPosition[]>();
  for (const p of positions) {
    if (p.isCapital || p.quantity <= 0) continue;
    bySymbol.set(p.assetSymbol, [...(bySymbol.get(p.assetSymbol) ?? []), p]);
  }

  const rows: ReviewRow[] = [...bySymbol.values()].map((group) => {
    const first = group[0]!;
    const quantity = group.reduce((s, p) => s + p.quantity, 0);
    const invested = group.reduce((s, p) => s + p.quantity * p.averageCost, 0);
    const value = group.reduce((s, p) => s + p.currentValue, 0);
    const buyPrice = quantity > 0 ? invested / quantity : 0;
    const fixedDates = group.map((p) => p.costFixedAt).filter((d): d is string => !!d).sort();
    return {
      assetSymbol: first.assetSymbol,
      assetName: first.assetName,
      quantity,
      buyPrice,
      currentPrice: first.currentPrice,
      invested,
      value,
      pnl: value - invested,
      changePercent: buyPrice > 0 ? ((first.currentPrice - buyPrice) / buyPrice) * 100 : 0,
      change24h: first.changePercent24h ?? 0,
      costSource: first.costSource ?? "manual",
      costFixedAt: fixedDates[0] ?? null,
    };
  });
  rows.sort((a, b) => b.changePercent - a.changePercent);

  const invested = rows.reduce((s, r) => s + r.invested, 0);
  const value = rows.reduce((s, r) => s + r.value, 0);
  return {
    rows,
    summary: {
      invested,
      value,
      pnl: value - invested,
      pnlPercent: invested > 0 ? ((value - invested) / invested) * 100 : 0,
      up: rows.filter((r) => r.changePercent > 0.005).length,
      down: rows.filter((r) => r.changePercent < -0.005).length,
      best: rows[0] && rows[0].changePercent > 0 ? rows[0] : null,
      worst: rows.length > 0 && rows[rows.length - 1]!.changePercent < 0 ? rows[rows.length - 1]! : null,
    },
  };
}
