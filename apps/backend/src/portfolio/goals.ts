// Progreso de una meta de inversión. Funciones puras (ver goals.spec.ts).
//  - target_value: llegar a un valor (p.ej. 10.000 USD), con fecha opcional.
//  - gain_percent: llegar a un % de ganancia sobre lo invertido (p.ej. +10 %).
//  - asset_quantity: juntar una cantidad de una moneda (p.ej. 0,5 BTC).
//  - target_price: que una moneda llegue a un precio (p.ej. ETH a 4.000),
//    hacia arriba o hacia abajo según dónde estaba al crear la meta.
// Las dos primeras pueden ser de todo el portafolio o de un activo; las dos
// últimas son siempre de un activo. El contexto lo arma el servicio.

export type GoalKind =
  'target_value' | 'gain_percent' | 'asset_quantity' | 'target_price';

export type PriceDirection = 'above' | 'below';

export interface GoalDefinition {
  kind: GoalKind;
  targetValue: number | null;
  targetPercent: number | null;
  targetQuantity: number | null;
  targetPrice: number | null;
  priceDirection: PriceDirection | null;
  deadline: Date | null;
  // Metas de precio: una vez tocado el precio, queda cumplida.
  completedAt: Date | null;
}

export interface GoalContext {
  now: Date;
  currentValue: number; // valor actual (portafolio sin capital, o del activo)
  invested: number; // costo de lo que se tiene
  gain: number; // ganancia realizada + no realizada
  quantity: number; // cantidad del activo (metas de un activo)
  price: number; // precio actual del activo (metas de un activo)
}

export type GoalStatus = 'achieved' | 'in_progress' | 'expired';

export interface GoalProgress {
  status: GoalStatus;
  // 0..1 para la barra (se recorta a 1 al cumplirse; si va en contra, 0).
  progress: number;
  // Valor, %, cantidad o precio actual y objetivo, según el tipo.
  current: number;
  target: number;
  // Valor (en la moneda base) que haría falta tener para cumplirla.
  targetValueEquivalent: number;
  remainingValue: number; // cuánto falta en la moneda base (0 si cumplida)
  daysLeft: number | null;
  // Cuánto tendría que crecer el valor por mes para llegar a tiempo.
  neededPerMonth: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const DAYS_PER_MONTH = 30.44;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Dirección de una meta de precio: si al crearla el precio está por debajo
// del objetivo, se espera que suba; si está por encima, que baje.
export function priceDirectionFor(
  currentPrice: number,
  targetPrice: number,
): PriceDirection {
  return currentPrice > targetPrice ? 'below' : 'above';
}

function currentAndTarget(
  goal: GoalDefinition,
  ctx: GoalContext,
): { current: number; target: number; achieved: boolean; progress: number } {
  switch (goal.kind) {
    case 'target_value': {
      const target = goal.targetValue ?? 0;
      return {
        current: ctx.currentValue,
        target,
        achieved: ctx.currentValue >= target,
        progress: target > 0 ? ctx.currentValue / target : 0,
      };
    }
    case 'gain_percent': {
      const target = goal.targetPercent ?? 0;
      const current = ctx.invested > 0 ? (ctx.gain / ctx.invested) * 100 : 0;
      return {
        current,
        target,
        achieved: ctx.invested > 0 && current >= target,
        progress: target > 0 ? current / target : 0,
      };
    }
    case 'asset_quantity': {
      const target = goal.targetQuantity ?? 0;
      return {
        current: ctx.quantity,
        target,
        achieved: target > 0 && ctx.quantity >= target,
        progress: target > 0 ? ctx.quantity / target : 0,
      };
    }
    case 'target_price': {
      const target = goal.targetPrice ?? 0;
      const below = goal.priceDirection === 'below';
      const touched = below ? ctx.price <= target : ctx.price >= target;
      return {
        current: ctx.price,
        target,
        achieved: goal.completedAt !== null || (ctx.price > 0 && touched),
        progress:
          target > 0 && ctx.price > 0
            ? below
              ? target / ctx.price
              : ctx.price / target
            : 0,
      };
    }
  }
}

export function computeGoalProgress(
  goal: GoalDefinition,
  ctx: GoalContext,
): GoalProgress {
  const { current, target, achieved, progress } = currentAndTarget(goal, ctx);

  const targetValueEquivalent =
    goal.kind === 'target_value'
      ? target
      : goal.kind === 'gain_percent'
        ? ctx.invested * (1 + target / 100)
        : goal.kind === 'asset_quantity'
          ? target * ctx.price
          : ctx.quantity * target;
  const remainingValue =
    goal.kind === 'target_price'
      ? 0
      : Math.max(0, targetValueEquivalent - ctx.currentValue);

  const daysLeft = goal.deadline
    ? Math.ceil((goal.deadline.getTime() - ctx.now.getTime()) / DAY_MS)
    : null;
  const status: GoalStatus = achieved
    ? 'achieved'
    : daysLeft !== null && daysLeft < 0
      ? 'expired'
      : 'in_progress';

  const neededPerMonth =
    !achieved &&
    goal.kind !== 'target_price' &&
    daysLeft !== null &&
    daysLeft > 0
      ? remainingValue / Math.max(daysLeft / DAYS_PER_MONTH, 1 / DAYS_PER_MONTH)
      : null;

  return {
    status,
    progress: achieved ? 1 : clamp01(progress),
    current,
    target,
    targetValueEquivalent,
    remainingValue: achieved ? 0 : remainingValue,
    daysLeft,
    neededPerMonth,
  };
}

// --- Proyección: a este ritmo, ¿cuándo se cumple? ---

export interface SeriesPoint {
  date: Date;
  value: number;
}

export interface GoalProjection {
  // Cuánto cambió la métrica por mes en el período (valor o cantidad).
  perMonth: number;
  // Fecha estimada en que se cumple a este ritmo (null si no avanza).
  etaDate: string | null;
  // Si hay fecha límite: llega a tiempo a este ritmo.
  onTime: boolean | null;
  // Días de historia usados para el cálculo.
  basisDays: number;
}

const PROJECTION_WINDOW_DAYS = 90;
const MIN_BASIS_DAYS = 7;

// Ritmo por la recta de mínimos cuadrados sobre los últimos 90 días y fecha
// estimada para llegar del valor actual al objetivo. null si no hay
// suficiente historia (menos de 3 puntos o de una semana).
export function projectGoal(
  series: SeriesPoint[],
  current: number,
  target: number,
  now: Date,
  deadline: Date | null,
): GoalProjection | null {
  const since = now.getTime() - PROJECTION_WINDOW_DAYS * DAY_MS;
  const points = series
    .filter((p) => p.date.getTime() >= since && Number.isFinite(p.value))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (points.length < 3) return null;
  const basisDays =
    (points[points.length - 1].date.getTime() - points[0].date.getTime()) /
    DAY_MS;
  if (basisDays < MIN_BASIS_DAYS) return null;

  const xs = points.map(
    (p) => (p.date.getTime() - points[0].date.getTime()) / DAY_MS,
  );
  const ys = points.map((p) => p.value);
  const n = points.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const perDay = den > 0 ? num / den : 0;
  const remaining = target - current;

  let etaDate: string | null = null;
  if (remaining <= 0) {
    etaDate = now.toISOString();
  } else if (perDay > 0) {
    etaDate = new Date(
      now.getTime() + (remaining / perDay) * DAY_MS,
    ).toISOString();
  }
  const onTime =
    deadline === null
      ? null
      : etaDate !== null && new Date(etaDate).getTime() <= deadline.getTime();

  return {
    perMonth: perDay * DAYS_PER_MONTH,
    etaDate,
    onTime,
    basisDays: Math.round(basisDays),
  };
}

// --- Historia para el gráfico de progreso ---

// Precio por día de una moneda a partir de su valor y cantidad en los
// snapshots (solo los días en que se tenía y había precio).
export function priceSeries(
  values: SeriesPoint[],
  quantities: SeriesPoint[],
): SeriesPoint[] {
  const qtyByDay = new Map(
    quantities.map((q) => [q.date.toISOString().slice(0, 10), q.value]),
  );
  return values.flatMap((v) => {
    const qty = qtyByDay.get(v.date.toISOString().slice(0, 10)) ?? 0;
    return qty > 0 && v.value > 0
      ? [{ date: v.date, value: v.value / qty }]
      : [];
  });
}

// Serie diaria (YYYY-MM-DD) de lo que mide la meta, terminando con el valor
// de hoy para que coincida con el progreso que se muestra.
export function goalHistory(
  series: SeriesPoint[],
  current: number,
  now: Date,
): { date: string; value: number }[] {
  const today = now.toISOString().slice(0, 10);
  const byDay = new Map<string, number>();
  for (const p of series) byDay.set(p.date.toISOString().slice(0, 10), p.value);
  byDay.set(today, current);
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}
