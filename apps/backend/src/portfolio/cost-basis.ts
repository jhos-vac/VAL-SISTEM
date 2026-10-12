// Núcleo financiero del producto: costo promedio ponderado (weighted
// average cost) y ganancia realizada / no realizada. Son funciones puras
// (sin Prisma ni Nest) para poder testearlas aisladas — ver
// cost-basis.spec.ts. Las usan TransactionService (alta manual),
// BinanceAccountSyncService (costo base desde myTrades) y PortfolioService
// (resumen del portafolio).

export type PositionMovementType =
  'buy' | 'sell' | 'transfer_in' | 'transfer_out';

export interface PositionState {
  quantity: number;
  avgPrice: number;
  realizedProfit: number;
}

export interface PositionMovement {
  type: PositionMovementType;
  quantity: number;
  price: number;
  fee?: number;
}

export class InsufficientQuantityError extends Error {
  constructor() {
    super(
      'No hay suficiente cantidad en la posición para esta venta/transferencia',
    );
    this.name = 'InsufficientQuantityError';
  }
}

export const EMPTY_POSITION: PositionState = {
  quantity: 0,
  avgPrice: 0,
  realizedProfit: 0,
};

// Aplica un movimiento manual a una posición:
//  - buy/transfer_in: suma cantidad, recalcula el costo promedio.
//  - sell/transfer_out: resta cantidad (falla si no alcanza), el costo
//    promedio NO cambia; solo `sell` acumula ganancia realizada
//    (transfer_out es solo mover activos, no una venta). La comisión de
//    la venta se descuenta de la ganancia realizada.
export function applyMovement(
  position: PositionState | null | undefined,
  movement: PositionMovement,
): PositionState {
  const current = position ?? EMPTY_POSITION;
  const isIncrease = movement.type === 'buy' || movement.type === 'transfer_in';

  if (isIncrease) {
    const quantity = current.quantity + movement.quantity;
    const avgPrice =
      current.quantity > 0
        ? (current.quantity * current.avgPrice +
            movement.quantity * movement.price) /
          quantity
        : movement.price;
    return { quantity, avgPrice, realizedProfit: current.realizedProfit };
  }

  if (current.quantity < movement.quantity) {
    throw new InsufficientQuantityError();
  }
  const realizedProfitDelta =
    movement.type === 'sell'
      ? movement.quantity * (movement.price - current.avgPrice) -
        (movement.fee ?? 0)
      : 0;
  return {
    quantity: current.quantity - movement.quantity,
    avgPrice: current.avgPrice,
    realizedProfit: current.realizedProfit + realizedProfitDelta,
  };
}

export interface TradeForCostBasis {
  isBuyer: boolean;
  qty: number;
  price: number;
}

export interface CostBasis {
  avgPrice: number;
  realizedProfit: number;
}

// Costo promedio ponderado a partir del historial de trades de un
// exchange, mismo método que applyMovement: cada compra recalcula el
// promedio, cada venta lo deja igual y solo acumula ganancia realizada.
// Los trades tienen que venir en orden cronológico.
//
// A diferencia del alta manual, una venta mayor a lo que se tiene no
// falla: se recorta a la cantidad disponible (el resto vino de depósitos
// que no aparecen en myTrades). Las comisiones no se descuentan porque
// Binance las cobra en distintos activos (BNB, la moneda base, etc.).
//
// Simplificación conocida: si el usuario depositó el activo directo al
// exchange o lo movió entre cuentas, esos movimientos no aparecen en los
// trades — el cálculo asume que toda la cantidad vino de estos trades.
export function computeCostBasisFromTrades(
  trades: TradeForCostBasis[],
): CostBasis {
  let quantity = 0;
  let avgPrice = 0;
  let realizedProfit = 0;

  for (const t of trades) {
    if (t.isBuyer) {
      const newQuantity = quantity + t.qty;
      avgPrice =
        newQuantity > 0
          ? (quantity * avgPrice + t.qty * t.price) / newQuantity
          : t.price;
      quantity = newQuantity;
    } else {
      const sellQty = Math.min(t.qty, quantity);
      realizedProfit += sellQty * (t.price - avgPrice);
      quantity = Math.max(0, quantity - t.qty);
    }
  }

  return { avgPrice, realizedProfit };
}

export interface PositionValuation {
  currentPrice: number;
  currentValue: number;
  unrealizedPnl: number;
}

// Valor actual y ganancia no realizada de una posición. Sin precio de
// mercado (activo sin ticker sincronizado) se usa el costo promedio, así
// la ganancia no realizada queda en 0 en vez de mostrar una pérdida falsa.
export function valuePosition(
  quantity: number,
  avgPrice: number,
  marketPrice: number | undefined,
): PositionValuation {
  const currentPrice = marketPrice ?? avgPrice;
  const currentValue = quantity * currentPrice;
  return {
    currentPrice,
    currentValue,
    unrealizedPnl: currentValue - quantity * avgPrice,
  };
}

export interface ValuedPosition {
  quantity: number;
  averageCost: number;
  currentValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
  changePercent24h: number;
}

export interface PortfolioTotals {
  totalValue: number;
  totalInvested: number;
  realizedPnl: number;
  unrealizedPnl: number;
  changePercent24h: number;
}

// Totales del portafolio. La variación 24h es el promedio de la variación
// de cada activo, ponderado por cuánto pesa ese activo en el valor total.
export function summarizePositions(
  positions: ValuedPosition[],
): PortfolioTotals {
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalInvested = positions.reduce(
    (sum, p) => sum + p.quantity * p.averageCost,
    0,
  );
  const realizedPnl = positions.reduce((sum, p) => sum + p.realizedPnl, 0);
  const unrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const changePercent24h =
    totalValue > 0
      ? positions.reduce(
          (sum, p) => sum + p.changePercent24h * (p.currentValue / totalValue),
          0,
        )
      : 0;
  return {
    totalValue,
    totalInvested,
    realizedPnl,
    unrealizedPnl,
    changePercent24h,
  };
}
