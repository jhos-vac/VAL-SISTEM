// Ítems de un snapshot diario: uno por moneda (la tabla tiene un índice
// único en snapshot + activo). La misma moneda puede estar en varias
// wallets (Spot, Earn, Fondos, manual) o portafolios; acá se suman.
export interface SnapshotPosition {
  assetId: string;
  quantity: number;
  currentValue: number;
}

export interface SnapshotItem {
  assetId: string;
  quantity: number;
  value: number;
  // Porcentaje del valor total del portafolio.
  allocation: number;
}

export function snapshotItemsByAsset(
  positions: SnapshotPosition[],
  totalValue: number,
): SnapshotItem[] {
  const byAsset = new Map<string, { quantity: number; value: number }>();
  for (const p of positions) {
    const acc = byAsset.get(p.assetId) ?? { quantity: 0, value: 0 };
    acc.quantity += p.quantity;
    acc.value += p.currentValue;
    byAsset.set(p.assetId, acc);
  }
  return [...byAsset.entries()].map(([assetId, { quantity, value }]) => ({
    assetId,
    quantity,
    value,
    allocation: totalValue > 0 ? (value / totalValue) * 100 : 0,
  }));
}
