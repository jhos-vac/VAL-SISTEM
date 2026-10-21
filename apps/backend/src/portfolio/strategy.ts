// Estrategias de un portafolio. Funciones puras (ver strategy.spec.ts):
//  - Asignación objetivo: % deseado por activo y qué comprar/vender para
//    acercarse (rebalanceo).
//  - Plan de compras periódicas (DCA): lo planeado hasta hoy contra lo
//    comprado de verdad.

export interface TargetInput {
  assetId: string;
  assetSymbol: string;
  targetPercent: number;
}

export interface HoldingInput {
  assetId: string;
  assetSymbol: string;
  value: number;
}

export interface RebalanceRow {
  assetId: string;
  assetSymbol: string;
  currentValue: number;
  currentPercent: number;
  // null: el activo no tiene objetivo y los objetivos no suman 100 %.
  targetPercent: number | null;
  diffPercent: number | null; // actual − objetivo
  // > 0 comprar, < 0 vender (en la moneda base). null sin objetivo.
  suggestedTrade: number | null;
}

export interface RebalancePlan {
  totalValue: number;
  targetsSum: number;
  rows: RebalanceRow[];
}

const FULL = 100;
const TOLERANCE = 0.01;

// Si los objetivos suman 100 %, lo que se tiene sin objetivo debería ir a
// 0 % (se sugiere venderlo). Si suman menos, el resto queda libre y lo que
// no tiene objetivo no se toca.
export function computeRebalance(
  targets: TargetInput[],
  holdings: HoldingInput[],
): RebalancePlan {
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const targetsSum = targets.reduce((sum, t) => sum + t.targetPercent, 0);
  const complete = Math.abs(targetsSum - FULL) <= TOLERANCE;

  const rows = new Map<string, RebalanceRow>();
  const row = (assetId: string, assetSymbol: string) => {
    let r = rows.get(assetId);
    if (!r) {
      r = {
        assetId,
        assetSymbol,
        currentValue: 0,
        currentPercent: 0,
        targetPercent: complete ? 0 : null,
        diffPercent: null,
        suggestedTrade: null,
      };
      rows.set(assetId, r);
    }
    return r;
  };

  for (const h of holdings)
    row(h.assetId, h.assetSymbol).currentValue += h.value;
  for (const t of targets)
    row(t.assetId, t.assetSymbol).targetPercent = t.targetPercent;

  for (const r of rows.values()) {
    r.currentPercent = totalValue > 0 ? (r.currentValue / totalValue) * 100 : 0;
    if (r.targetPercent !== null) {
      r.diffPercent = r.currentPercent - r.targetPercent;
      r.suggestedTrade = (r.targetPercent / 100) * totalValue - r.currentValue;
    }
  }

  return {
    totalValue,
    targetsSum,
    rows: [...rows.values()].sort(
      (a, b) =>
        (b.targetPercent ?? -1) - (a.targetPercent ?? -1) ||
        b.currentValue - a.currentValue,
    ),
  };
}

export type DcaFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface DcaPlanInput {
  amount: number;
  frequency: DcaFrequency;
  startDate: Date;
  endDate: Date | null;
}

export interface DcaBuy {
  executedAt: Date;
  total: number; // monto gastado en la compra
}

export interface DcaProgress {
  periodsDue: number; // compras que ya tocaban (incluida la de hoy)
  plannedAmount: number;
  investedAmount: number;
  // invertido / planeado (puede pasar de 1 si se compró de más)
  progress: number;
  nextDate: string | null; // próxima compra planeada (null si terminó)
  finished: boolean;
}

export function addPeriods(
  start: Date,
  frequency: DcaFrequency,
  n: number,
): Date {
  const d = new Date(start.getTime());
  if (frequency === 'monthly') {
    d.setUTCMonth(d.getUTCMonth() + n);
  } else {
    d.setUTCDate(d.getUTCDate() + n * (frequency === 'weekly' ? 7 : 14));
  }
  return d;
}

export function computeDcaProgress(
  plan: DcaPlanInput,
  buys: DcaBuy[],
  now: Date,
): DcaProgress {
  const until = plan.endDate && plan.endDate < now ? plan.endDate : now;

  // Cuenta las fechas de compra planeadas que ya llegaron.
  let periodsDue = 0;
  if (until >= plan.startDate) {
    while (addPeriods(plan.startDate, plan.frequency, periodsDue) <= until) {
      periodsDue++;
    }
  }
  const next = addPeriods(plan.startDate, plan.frequency, periodsDue);
  const finished = plan.endDate !== null && next > plan.endDate;

  const investedAmount = buys
    .filter(
      (b) =>
        b.executedAt >= plan.startDate &&
        (plan.endDate === null || b.executedAt <= plan.endDate),
    )
    .reduce((sum, b) => sum + b.total, 0);
  const plannedAmount = periodsDue * plan.amount;

  return {
    periodsDue,
    plannedAmount,
    investedAmount,
    progress: plannedAmount > 0 ? investedAmount / plannedAmount : 0,
    nextDate: finished ? null : next.toISOString(),
    finished,
  };
}
