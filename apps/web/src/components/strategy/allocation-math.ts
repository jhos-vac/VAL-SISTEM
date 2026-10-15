// Cálculos del editor de asignación objetivo, sin React: recortes al 100 %,
// repartos rápidos y sugerencias de compra/venta en vivo mientras se edita.
import type { RebalancePlan } from "@val-sistem/shared";

export interface DraftRow {
  assetSymbol: string;
  percent: number;
}

export const MAX_TOTAL = 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

export const totalOf = (rows: DraftRow[]) => round2(rows.reduce((s, r) => s + r.percent, 0));

// Lo máximo que puede tener una fila sin que el total pase de 100.
export function maxFor(rows: DraftRow[], index: number): number {
  const others = rows.reduce((s, r, i) => (i === index ? s : s + r.percent), 0);
  return round2(Math.max(0, MAX_TOTAL - others));
}

// Cambia el % de una fila, recortado a lo que queda libre.
export function setPercent(rows: DraftRow[], index: number, value: number): DraftRow[] {
  const safe = Number.isFinite(value) ? value : 0;
  const clamped = round2(Math.min(Math.max(0, safe), maxFor(rows, index)));
  return rows.map((r, i) => (i === index ? { ...r, percent: clamped } : r));
}

// Reparte el 100 % en partes iguales (el redondeo sobrante va al primero).
export function equalize(rows: DraftRow[]): DraftRow[] {
  if (rows.length === 0) return rows;
  const share = Math.floor((MAX_TOTAL / rows.length) * 100) / 100;
  const rest = round2(MAX_TOTAL - share * rows.length);
  return rows.map((r, i) => ({ ...r, percent: round2(share + (i === 0 ? rest : 0)) }));
}

// Reparte lo que falta para llegar a 100 en proporción a lo ya asignado (o
// en partes iguales si todo está en 0).
export function distributeRemaining(rows: DraftRow[]): DraftRow[] {
  const total = totalOf(rows);
  const remaining = round2(MAX_TOTAL - total);
  if (rows.length === 0 || remaining <= 0) return rows;
  if (total === 0) return equalize(rows);
  const next = rows.map((r) => ({ ...r, percent: round2(r.percent + (r.percent / total) * remaining) }));
  // Ajuste de redondeo para que el total quede exacto en 100.
  const diff = round2(MAX_TOTAL - totalOf(next));
  if (diff !== 0) next[0] = { ...next[0], percent: round2(next[0].percent + diff) };
  return next;
}

// Composición actual del portafolio como punto de partida.
export function fromCurrent(plan: RebalancePlan): DraftRow[] {
  const held = plan.rows.filter((r) => r.currentValue > 0);
  if (held.length === 0) return [];
  const rows = held.map((r) => ({
    assetSymbol: r.assetSymbol,
    percent: Math.floor(r.currentPercent * 100) / 100,
  }));
  return distributeRemaining(rows);
}

export interface LiveSuggestion {
  assetSymbol: string;
  currentValue: number;
  currentPercent: number;
  targetPercent: number | null;
  // > 0 comprar, < 0 vender, null sin objetivo.
  trade: number | null;
}

// Mismas reglas que el backend (computeRebalance): con el 100 % asignado,
// lo que se tiene y no está en la estrategia se sugiere vender; si queda
// algo libre, eso no se toca.
export function liveSuggestions(plan: RebalancePlan, rows: DraftRow[]): LiveSuggestion[] {
  const complete = Math.abs(totalOf(rows) - MAX_TOTAL) < 0.01;
  const current = new Map(plan.rows.map((r) => [r.assetSymbol, r]));
  const out: LiveSuggestion[] = rows.map((r) => {
    const value = current.get(r.assetSymbol)?.currentValue ?? 0;
    return {
      assetSymbol: r.assetSymbol,
      currentValue: value,
      currentPercent: plan.totalValue > 0 ? (value / plan.totalValue) * 100 : 0,
      targetPercent: r.percent,
      trade: (r.percent / 100) * plan.totalValue - value,
    };
  });
  const inDraft = new Set(rows.map((r) => r.assetSymbol));
  for (const r of plan.rows) {
    if (inDraft.has(r.assetSymbol) || r.currentValue <= 0) continue;
    out.push({
      assetSymbol: r.assetSymbol,
      currentValue: r.currentValue,
      currentPercent: r.currentPercent,
      targetPercent: complete ? 0 : null,
      trade: complete ? -r.currentValue : null,
    });
  }
  return out;
}

// Orden fijo de colores para que cada activo tenga el mismo color en el
// editor y en la vista: primero lo que se tiene (de mayor a menor valor),
// después el resto del plan y por último lo agregado en el editor.
export function colorOrder(plan: RebalancePlan, extra: string[] = []): string[] {
  const held = [...plan.rows]
    .filter((r) => r.currentValue > 0)
    .sort((a, b) => b.currentValue - a.currentValue)
    .map((r) => r.assetSymbol);
  return [...new Set([...held, ...plan.rows.map((r) => r.assetSymbol), ...extra])];
}
