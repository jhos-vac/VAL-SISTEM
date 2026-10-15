import { summarizePositions, type ValuedPosition } from './cost-basis';

// Lo que se muestra de un portafolio público. SOLO porcentajes: ningún
// monto, cantidad, wallet ni transacción del dueño sale de acá.

export interface PublicPosition extends ValuedPosition {
  assetId: string;
  assetSymbol: string;
  assetName: string;
}

export interface CompositionItem {
  assetId: string;
  assetSymbol: string;
  assetName: string;
  percent: number; // % del valor total
  isCapital: boolean;
  // Ganancia no realizada del activo sobre su costo (null para capital).
  returnPercent: number | null;
}

export interface PublicStats {
  // (ganancia realizada + no realizada) / invertido, sin capital.
  returnPercent: number;
  changePercent24h: number;
  assetsCount: number;
  composition: CompositionItem[];
  hasInvestment: boolean;
}

export function buildPublicStats(positions: PublicPosition[]): PublicStats {
  const totals = summarizePositions(positions);
  // El capital (p.ej. USDT) no es parte del portafolio: no se publica.
  const invested = positions.filter((p) => !p.isCapital);
  const byAsset = new Map<
    string,
    CompositionItem & { cost: number; pnl: number }
  >();
  for (const p of invested) {
    const item = byAsset.get(p.assetId) ?? {
      assetId: p.assetId,
      assetSymbol: p.assetSymbol,
      assetName: p.assetName,
      percent: 0,
      isCapital: !!p.isCapital,
      returnPercent: null,
      cost: 0,
      pnl: 0,
    };
    item.percent += p.currentValue;
    item.cost += p.quantity * p.averageCost;
    item.pnl += p.unrealizedPnl;
    byAsset.set(p.assetId, item);
  }

  const composition = [...byAsset.values()]
    .map(({ cost, pnl, ...item }) => ({
      ...item,
      percent:
        totals.totalValue > 0 ? (item.percent / totals.totalValue) * 100 : 0,
      returnPercent: item.isCapital || cost <= 0 ? null : (pnl / cost) * 100,
    }))
    .sort((a, b) => b.percent - a.percent);

  return {
    returnPercent:
      totals.totalInvested > 0
        ? ((totals.unrealizedPnl + totals.realizedPnl) / totals.totalInvested) *
          100
        : 0,
    changePercent24h: totals.changePercent24h,
    assetsCount: composition.length,
    composition,
    hasInvestment: totals.totalInvested > 0,
  };
}

// Asignación objetivo a partir de la composición de otro portafolio: los %
// se redondean hacia abajo a 2 decimales para que la suma no pase de 100.
export function compositionToTargets(
  composition: CompositionItem[],
): Array<{ assetId: string; targetPercent: number }> {
  return composition
    .map((c) => ({
      assetId: c.assetId,
      targetPercent: Math.floor(c.percent * 100) / 100,
    }))
    .filter((t) => t.targetPercent > 0);
}
