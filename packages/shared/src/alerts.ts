// Avisos, centro de notificaciones y lista de seguimiento.

export type AlertKind =
  | "price_above"
  | "price_below"
  | "asset_move"
  | "portfolio_move"
  | "strategy_drift"
  | "goal_events"
  | "dca_due";

// Lo que el usuario elige al crear un aviso ("price" se guarda como
// price_above o price_below según el precio actual).
export type NewAlertKind = "price" | "asset_move" | "portfolio_move" | "strategy_drift";

export interface AlertRule {
  id: string;
  kind: AlertKind;
  assetSymbol: string | null;
  portfolioId: string | null;
  portfolioName: string | null;
  threshold: number | null;
  repeat: boolean;
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface AlertsOverview {
  rules: AlertRule[];
  // Automáticos (se pueden apagar).
  auto: { goalEvents: boolean; dcaDue: boolean };
}

export interface CreateAlertInput {
  kind: NewAlertKind;
  assetSymbol?: string;
  portfolioId?: string;
  threshold: number;
  repeat?: boolean;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  unreadCount: number;
}

export interface WatchlistItem {
  assetSymbol: string;
  assetName: string;
  price: number | null;
  changePercent24h: number | null;
  addedAt: string;
}

export const NEW_ALERT_KIND_LABELS: Record<NewAlertKind, string> = {
  price: "Precio de una moneda",
  asset_move: "Movimiento fuerte de una moneda",
  portfolio_move: "Movimiento fuerte del portafolio",
  strategy_drift: "Estrategia desviada",
};

// "BTC llega a $90.000 (subiendo) · cada vez", "ETH se mueve ±5 % en 24 h"…
export function alertRuleText(rule: AlertRule, money: (n: number) => string): string {
  const t = rule.threshold ?? 0;
  switch (rule.kind) {
    case "price_above":
    case "price_below":
      return `${rule.assetSymbol ?? "?"} llega a ${money(t)} (${rule.kind === "price_above" ? "subiendo" : "bajando"}) · ${
        rule.repeat ? "cada vez que cruce" : "una sola vez"
      }`;
    case "asset_move":
      return `${rule.assetSymbol ?? "?"} se mueve ±${t} % en 24 h`;
    case "portfolio_move":
      return `${rule.portfolioName ?? "Todos tus portafolios"} se mueve ±${t} % en 24 h`;
    case "strategy_drift":
      return `Estrategia de ${rule.portfolioName ?? "tu portafolio"} se desvía ${t} puntos`;
    default:
      return rule.kind;
  }
}

// Fecha relativa corta para la lista de notificaciones.
export function timeAgo(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `hace ${d} d` : new Date(iso).toLocaleDateString("es-EC");
}
