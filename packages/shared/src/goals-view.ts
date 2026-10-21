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
