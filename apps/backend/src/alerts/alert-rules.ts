// Reglas de aviso: cuándo dispara cada tipo y qué dice el aviso. Funciones
// puras (ver alert-rules.spec.ts); el evaluador arma los datos.
import { addPeriods, type DcaFrequency } from '../portfolio/strategy';

export const ALERT_KINDS = [
  'price_above',
  'price_below',
  'asset_move',
  'portfolio_move',
  'strategy_drift',
  'goal_events',
  'dca_due',
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

// Avisos automáticos: activos salvo que el usuario los apague.
export const AUTO_KINDS: readonly AlertKind[] = ['goal_events', 'dca_due'];

// Espera mínima entre dos avisos de la misma regla (movimientos y desvíos).
export const COOLDOWN_HOURS: Partial<Record<AlertKind, number>> = {
  asset_move: 12,
  portfolio_move: 12,
  strategy_drift: 24,
};

export interface PendingNotification {
  userId: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  // Evita repetir el mismo aviso (único por usuario).
  dedupeKey: string;
}

type Fmt = (n: number) => string;

const pct = (n: number) =>
  `${n > 0 ? '+' : ''}${n.toLocaleString('es-EC', { maximumFractionDigits: 2 })} %`;

const HOUR_MS = 3_600_000;

export function cooldownPassed(
  kind: AlertKind,
  lastTriggeredAt: Date | null,
  now: Date,
): boolean {
  const hours = COOLDOWN_HOURS[kind];
  if (!hours || !lastTriggeredAt) return true;
  return now.getTime() - lastTriggeredAt.getTime() >= hours * HOUR_MS;
}

// --- Precio de una moneda ---

export function priceMet(
  kind: 'price_above' | 'price_below',
  price: number,
  threshold: number,
): boolean {
  return kind === 'price_above' ? price >= threshold : price <= threshold;
}

// Avisa solo al cruzar: la condición se cumple ahora y antes no.
export function crossed(met: boolean, lastMet: boolean): boolean {
  return met && !lastMet;
}

export function priceNotification(
  rule: {
    id: string;
    userId: string;
    kind: 'price_above' | 'price_below';
    threshold: number;
  },
  symbol: string,
  price: number,
  money: Fmt,
  now: Date,
): PendingNotification {
  const up = rule.kind === 'price_above';
  return {
    userId: rule.userId,
    kind: rule.kind,
    title: `${symbol} ${up ? 'subió' : 'bajó'} a ${money(price)}`,
    body: `Llegó a tu precio de aviso de ${money(rule.threshold)}.`,
    link: '/market',
    dedupeKey: `rule:${rule.id}:${now.toISOString().slice(0, 16)}`,
  };
}

// --- Movimientos fuertes en 24 h ---

export function moveMet(changePercent: number, threshold: number): boolean {
  return Math.abs(changePercent) >= threshold;
}

export function moveNotification(
  rule: {
    id: string;
    userId: string;
    kind: 'asset_move' | 'portfolio_move';
    threshold: number;
  },
  label: string,
  changePercent: number,
  now: Date,
): PendingNotification {
  const up = changePercent >= 0;
  return {
    userId: rule.userId,
    kind: rule.kind,
    title: `${label} ${up ? 'sube' : 'cae'} ${pct(changePercent)} en 24 h`,
    body: `Superó tu aviso de movimientos de ±${rule.threshold} %.`,
    link: rule.kind === 'asset_move' ? '/market' : '/dashboard',
    dedupeKey: `rule:${rule.id}:${now.toISOString().slice(0, 13)}`,
  };
}

// --- Estrategia ---

// El mayor desvío (en puntos) entre el % actual y el objetivo.
export function maxDrift(
  rows: { assetSymbol: string; diffPercent: number | null }[],
): {
  assetSymbol: string;
  diff: number;
} | null {
  let worst: { assetSymbol: string; diff: number } | null = null;
  for (const r of rows) {
    if (r.diffPercent === null) continue;
    if (!worst || Math.abs(r.diffPercent) > Math.abs(worst.diff)) {
      worst = { assetSymbol: r.assetSymbol, diff: r.diffPercent };
    }
  }
  return worst;
}

export function driftNotification(
  rule: { id: string; userId: string; threshold: number },
  portfolioName: string,
  worst: { assetSymbol: string; diff: number },
  now: Date,
): PendingNotification {
  return {
    userId: rule.userId,
    kind: 'strategy_drift',
    title: `Tu estrategia de ${portfolioName} se desvió`,
    body: `${worst.assetSymbol} está ${Math.abs(worst.diff).toFixed(1)} puntos ${worst.diff > 0 ? 'por encima' : 'por debajo'} de su objetivo. Conviene rebalancear.`,
    link: '/strategy',
    dedupeKey: `rule:${rule.id}:${now.toISOString().slice(0, 10)}`,
  };
}

// --- Metas ---

export interface GoalForEvents {
  id: string;
  name: string;
  progress: {
    status: 'achieved' | 'in_progress' | 'expired';
    progress: number;
  };
  projection: { onTime: boolean | null } | null;
  kind: string;
}

// Semana ISO (para avisar "vas atrasado" como mucho una vez por semana).
function isoWeek(d: Date): string {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Meta cumplida, hito alcanzado (solo el más alto: no se manda 25 % si ya va
// por 80 %) y "vas atrasado" (semanal, según la proyección).
export function goalEvents(
  userId: string,
  goal: GoalForEvents,
  now: Date,
): PendingNotification[] {
  const base = { userId, kind: 'goal_events', link: '/goals' };
  const out: PendingNotification[] = [];
  if (goal.progress.status === 'achieved') {
    out.push({
      ...base,
      title: `¡Cumpliste tu meta “${goal.name}”!`,
      body: 'Felicitaciones. La encuentras en Metas → Cumplidas.',
      dedupeKey: `goal:${goal.id}:achieved`,
    });
    return out;
  }
  if (goal.progress.status !== 'in_progress') return out;
  if (goal.kind !== 'target_price') {
    const milestone = [0.75, 0.5, 0.25].find(
      (m) => goal.progress.progress >= m,
    );
    if (milestone) {
      out.push({
        ...base,
        title: `“${goal.name}” va por el ${Math.round(milestone * 100)} %`,
        body: 'Llegaste a un hito de tu meta.',
        dedupeKey: `goal:${goal.id}:m${Math.round(milestone * 100)}`,
      });
    }
  }
  if (goal.projection?.onTime === false) {
    out.push({
      ...base,
      title: `Vas atrasado con “${goal.name}”`,
      body: 'A este ritmo no llegas a la fecha. Revisa el plan sugerido en Metas.',
      dedupeKey: `goal:${goal.id}:behind:${isoWeek(now)}`,
    });
  }
  return out;
}

// --- Compras periódicas (DCA) ---

export interface DcaForAlert {
  id: string;
  assetSymbol: string;
  amount: number;
  frequency: DcaFrequency;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
}

// ¿Alguna de las compras programadas del plan cae hoy (UTC)?
export function dcaDueToday(plan: DcaForAlert, now: Date): boolean {
  if (!plan.isActive) return false;
  const start = new Date(plan.startDate);
  const end = plan.endDate ? new Date(plan.endDate) : null;
  const today = now.toISOString().slice(0, 10);
  for (let n = 0; n < 10_000; n++) {
    const date = addPeriods(start, plan.frequency, n);
    if (end && date > end) return false;
    const day = date.toISOString().slice(0, 10);
    if (day === today) return true;
    if (day > today) return false;
  }
  return false;
}

export function dcaDueNotification(
  userId: string,
  plan: DcaForAlert,
  money: Fmt,
  now: Date,
): PendingNotification | null {
  if (!dcaDueToday(plan, now)) return null;
  const today = now.toISOString().slice(0, 10);
  return {
    userId,
    kind: 'dca_due',
    title: `Hoy toca tu compra de ${plan.assetSymbol}`,
    body: `Tu plan: ${money(plan.amount)} de ${plan.assetSymbol}.`,
    link: '/strategy',
    dedupeKey: `dca:${plan.id}:${today}`,
  };
}
