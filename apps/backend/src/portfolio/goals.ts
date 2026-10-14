// Progreso de una meta de inversión. Funciones puras (ver goals.spec.ts).
//  - target_value: llegar a un valor (p.ej. 10.000 USD), con fecha opcional.
//  - gain_percent: llegar a un % de ganancia sobre lo invertido (p.ej. +10 %).
// La meta puede ser de todo el portafolio o de un solo activo; el contexto
// (valor, invertido, ganancia) lo arma el servicio para cada caso.

export type GoalKind = 'target_value' | 'gain_percent';

export interface GoalDefinition {
  kind: GoalKind;
  targetValue: number | null;
  targetPercent: number | null;
  deadline: Date | null;
}

export interface GoalContext {
  now: Date;
  currentValue: number; // valor actual (portafolio sin capital, o del activo)
  invested: number; // costo de lo que se tiene
  gain: number; // ganancia realizada + no realizada
}

export type GoalStatus = 'achieved' | 'in_progress' | 'expired';

export interface GoalProgress {
  status: GoalStatus;
  // 0..1 para la barra (se recorta a 1 al cumplirse; si va en contra, 0).
  progress: number;
  current: number; // valor actual o % actual, según el tipo
  target: number; // valor o % objetivo
  // Valor de portafolio que haría falta para cumplirla.
  targetValueEquivalent: number;
  remainingValue: number; // cuánto falta en la moneda base (0 si cumplida)
  daysLeft: number | null;
  // Cuánto tendría que crecer el valor por mes para llegar a tiempo.
  neededPerMonth: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.44;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function computeGoalProgress(
  goal: GoalDefinition,
  ctx: GoalContext,
): GoalProgress {
  const isValue = goal.kind === 'target_value';
  const target = (isValue ? goal.targetValue : goal.targetPercent) ?? 0;
  const currentPercent = ctx.invested > 0 ? (ctx.gain / ctx.invested) * 100 : 0;
  const current = isValue ? ctx.currentValue : currentPercent;

  const targetValueEquivalent = isValue
    ? target
    : ctx.invested * (1 + target / 100);
  const remainingValue = Math.max(0, targetValueEquivalent - ctx.currentValue);
  const achieved = isValue
    ? ctx.currentValue >= target
    : ctx.invested > 0 && currentPercent >= target;

  const daysLeft = goal.deadline
    ? Math.ceil((goal.deadline.getTime() - ctx.now.getTime()) / DAY_MS)
    : null;
  const status: GoalStatus = achieved
    ? 'achieved'
    : daysLeft !== null && daysLeft < 0
      ? 'expired'
      : 'in_progress';

  const neededPerMonth =
    !achieved && daysLeft !== null && daysLeft > 0
      ? remainingValue / Math.max(daysLeft / DAYS_PER_MONTH, 1 / DAYS_PER_MONTH)
      : null;

  return {
    status,
    progress: target > 0 ? clamp01(current / target) : achieved ? 1 : 0,
    current,
    target,
    targetValueEquivalent,
    remainingValue: achieved ? 0 : remainingValue,
    daysLeft,
    neededPerMonth,
  };
}
