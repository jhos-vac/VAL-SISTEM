// Textos de las metas, iguales en web y móvil: qué se busca, cómo se mide y
// qué dice la proyección.
import { formatPercent, formatQuantity } from "./format";
import type { Goal, GoalKind } from "./strategy";

type Money = (n: number) => string;

export function isAssetGoalKind(kind: GoalKind): boolean {
  return kind === "asset_quantity" || kind === "target_price";
}

// Formatea un valor de lo que mide la meta (dinero, %, cantidad o precio).
export function formatGoalMetric(kind: GoalKind, n: number, money: Money, symbol?: string | null): string {
  if (kind === "gain_percent") return formatPercent(n);
  if (kind === "asset_quantity") return `${formatQuantity(n)}${symbol ? ` ${symbol}` : ""}`;
  return money(n);
}

// "Llegar a $10.000", "Ganar +10 %", "Juntar 0,5 BTC", "ETH a $4.000 (subiendo)".
export function goalTargetText(goal: Goal, money: Money): string {
  const asset = goal.assetSymbol;
  switch (goal.kind) {
    case "target_value":
      return `${asset ? `${asset} · ` : ""}Llegar a ${money(goal.targetValue ?? 0)}`;
    case "gain_percent":
      return `${asset ? `${asset} · ` : ""}Ganar ${formatPercent(goal.targetPercent ?? 0)}`;
    case "asset_quantity":
      return `Juntar ${formatQuantity(goal.targetQuantity ?? 0)} ${asset ?? ""}`.trim();
    case "target_price":
      return `${asset ?? ""} a ${money(goal.targetPrice ?? 0)} (${goal.priceDirection === "below" ? "bajando" : "subiendo"})`.trim();
  }
}

// Nombre sugerido si el usuario no escribe uno.
export function defaultGoalName(kind: GoalKind, target: number, money: Money, symbol?: string | null): string {
  switch (kind) {
    case "target_value":
      return `Llegar a ${money(target)}`;
    case "gain_percent":
      return `${symbol ? `${symbol} ` : ""}${formatPercent(target)}`;
    case "asset_quantity":
      return `${formatQuantity(target)} ${symbol ?? ""}`.trim();
    case "target_price":
      return `${symbol ?? ""} a ${money(target)}`.trim();
  }
}

const dateText = (iso: string) =>
  new Date(iso).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" });

// Frase de la proyección, o null si no aplica (metas de precio, cumplidas o
// sin historia suficiente).
export function projectionText(goal: Goal, money: Money): { text: string; tone: "good" | "warning" | "neutral" } | null {
  const p = goal.projection;
  if (!p || goal.progress.status !== "in_progress") return null;
  const pace =
    goal.kind === "asset_quantity"
      ? `${p.perMonth >= 0 ? "+" : "−"}${formatQuantity(Math.abs(p.perMonth))} ${goal.assetSymbol ?? ""} por mes`.trim()
      : `${p.perMonth >= 0 ? "+" : "−"}${money(Math.abs(p.perMonth))} por mes`;
  if (!p.etaDate) {
    return {
      text: `A este ritmo (${pace} en los últimos ${p.basisDays} días) no se cumple: hace falta avanzar más.`,
      tone: "warning",
    };
  }
  const when = `A este ritmo (${pace}) la cumples el ${dateText(p.etaDate)}`;
  if (p.onTime === true) return { text: `${when}: llegas a tiempo.`, tone: "good" };
  if (p.onTime === false) return { text: `${when}: después de la fecha límite.`, tone: "warning" };
  return { text: `${when}.`, tone: "neutral" };
}

// --- Hitos ---

export const GOAL_MILESTONES = [0.25, 0.5, 0.75] as const;

// El hito más alto alcanzado (0.25, 0.5 o 0.75), o null.
export function reachedMilestone(goal: Goal): number | null {
  if (goal.progress.status === "achieved") return null;
  const reached = GOAL_MILESTONES.filter((m) => goal.progress.progress >= m);
  return reached.length > 0 ? reached[reached.length - 1]! : null;
}

// --- Plan de compras sugerido ---

export interface SuggestedPlan {
  // Monto por compra semanal (redondeado) y cantidad de compras hasta la
  // fecha límite.
  amountPerWeek: number;
  purchases: number;
  endDate: string;
}

// Cuánto comprar por semana para cubrir lo que falta antes de la fecha
// límite, sin contar lo que suba o baje el mercado. Solo para metas en curso
// con fecha que se cumplen aportando dinero (no las de precio).
export function suggestedPlan(goal: Goal): SuggestedPlan | null {
  const p = goal.progress;
  if (goal.kind === "target_price" || p.status !== "in_progress") return null;
  if (!goal.deadline || p.daysLeft === null || p.daysLeft <= 0 || p.remainingValue <= 0) return null;
  const purchases = Math.max(1, Math.ceil(p.daysLeft / 7));
  const raw = p.remainingValue / purchases;
  const amountPerWeek = raw >= 100 ? Math.ceil(raw / 5) * 5 : Math.ceil(raw * 100) / 100;
  return { amountPerWeek, purchases, endDate: goal.deadline };
}
