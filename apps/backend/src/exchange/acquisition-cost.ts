// Precio de compra de las monedas que NO tienen historial de trades en
// Binance (llegaron por Convertir, compra con tarjeta, depósito, Earn…).
// El precio de compra tiene que quedar FIJO: se calcula una vez, con el
// precio de cada transacción en el momento en que ocurrió, y los syncs
// siguientes lo conservan.

import type { CostSource } from '../portfolio/cost-basis';

export type { CostSource };

export interface Acquisition {
  quantity: number;
  // Epoch ms.
  time: number;
  // Precio en USDT por unidad en ese momento.
  price: number;
}

// Costo promedio de lo que se tiene hoy, a partir de las entradas
// conocidas. Con FIFO lo que queda son las entradas más recientes, así que
// se toman de la más nueva hacia atrás hasta cubrir la cantidad. Lo que no
// se cubre (p. ej. recompensas de Earn sin registro) se valora a
// `fallbackPrice`. Devuelve null si ninguna entrada sirvió.
export function costFromAcquisitions(
  held: number,
  acquisitions: Acquisition[],
  fallbackPrice: number,
): { avgPrice: number; covered: number } | null {
  if (held <= 0) return null;
  const usable = acquisitions
    .filter((a) => a.quantity > 0 && a.price > 0)
    .sort((a, b) => b.time - a.time);
  let remaining = held;
  let cost = 0;
  for (const a of usable) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, a.quantity);
    cost += take * a.price;
    remaining -= take;
  }
  const covered = held - remaining;
  if (covered <= 0) return null;
  cost += remaining * fallbackPrice;
  return { avgPrice: cost / held, covered };
}

// Conserva el precio fijado en syncs anteriores. Si ahora hay más cantidad
// (llegó más moneda sin trade registrado), solo esa parte nueva se valora
// al precio actual; si hay menos (se vendió o retiró), el precio no cambia.
export function carryForwardCost(
  previous: { quantity: number; avgPrice: number },
  quantity: number,
  currentPrice: number,
): number {
  const EPSILON = 1e-12;
  if (quantity <= previous.quantity + EPSILON || previous.quantity <= 0) {
    return previous.quantity > 0 ? previous.avgPrice : currentPrice;
  }
  const added = quantity - previous.quantity;
  return (
    (previous.quantity * previous.avgPrice + added * currentPrice) / quantity
  );
}
