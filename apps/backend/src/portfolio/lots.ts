// Seguimiento por compra ("lotes"): cada compra o entrada es un lote con su
// propio precio; las ventas y salidas lo van consumiendo en orden de
// llegada (FIFO). Es una VISTA: el costo promedio ponderado de la posición
// (cost-basis.ts) sigue siendo la referencia para el resumen; acá se ve cada
// compra por separado. Funciones puras, testeadas en lots.spec.ts.

export type LotMovementType = 'buy' | 'sell' | 'transfer_in' | 'transfer_out';

export interface LotMovement {
  id: string;
  type: LotMovementType;
  quantity: number;
  price: number;
  executedAt: Date;
}

export interface Lot {
  // Id de la transacción de compra que abrió el lote.
  id: string;
  source: 'buy' | 'transfer_in';
  openedAt: Date;
  quantity: number;
  price: number;
  // Lo que queda del lote después de ventas y salidas.
  remaining: number;
  // Ganancia ya realizada por las ventas que consumieron este lote.
  realizedPnl: number;
}

export interface LotsResult {
  lots: Lot[];
  // Cantidad vendida o retirada que no tenía un lote previo (p.ej. un
  // depósito en el exchange que no figura como compra).
  unmatchedOut: number;
}

const EPSILON = 1e-12;

export function buildLots(movements: LotMovement[]): LotsResult {
  const sorted = [...movements].sort(
    (a, b) => a.executedAt.getTime() - b.executedAt.getTime(),
  );
  const lots: Lot[] = [];
  let unmatchedOut = 0;

  for (const m of sorted) {
    if (m.type === 'buy' || m.type === 'transfer_in') {
      lots.push({
        id: m.id,
        source: m.type,
        openedAt: m.executedAt,
        quantity: m.quantity,
        price: m.price,
        remaining: m.quantity,
        realizedPnl: 0,
      });
      continue;
    }

    let toConsume = m.quantity;
    for (const lot of lots) {
      if (toConsume <= EPSILON) break;
      if (lot.remaining <= EPSILON) continue;
      const taken = Math.min(lot.remaining, toConsume);
      lot.remaining -= taken;
      toConsume -= taken;
      // Una salida (transfer_out) mueve el activo, no lo vende.
      if (m.type === 'sell') lot.realizedPnl += taken * (m.price - lot.price);
    }
    if (toConsume > EPSILON) unmatchedOut += toConsume;
  }

  for (const lot of lots) {
    if (Math.abs(lot.remaining) < EPSILON) lot.remaining = 0;
  }
  return { lots, unmatchedOut };
}

export interface ValuedLot extends Lot {
  invested: number; // remaining × precio de compra
  currentValue: number; // remaining × precio actual
  unrealizedPnl: number;
  unrealizedPercent: number;
  isOpen: boolean;
}

export function valueLot(lot: Lot, currentPrice: number): ValuedLot {
  const invested = lot.remaining * lot.price;
  const currentValue = lot.remaining * currentPrice;
  const unrealizedPnl = currentValue - invested;
  return {
    ...lot,
    invested,
    currentValue,
    unrealizedPnl,
    unrealizedPercent: invested > 0 ? (unrealizedPnl / invested) * 100 : 0,
    isOpen: lot.remaining > 0,
  };
}
