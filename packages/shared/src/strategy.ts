// Tipos de seguimiento por compra, metas, estrategias y portafolios
// públicos (contrato con el backend: ver apps/backend/src/contracts.spec.ts).

export interface Lot {
  id: string;
  source: 'buy' | 'transfer_in';
  openedAt: string;
  quantity: number;
  price: number;
  remaining: number;
  realizedPnl: number;
  invested: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPercent: number;
  isOpen: boolean;
  walletId: string;
  walletName: string;
}

export interface UntrackedHolding {
  walletId: string;
  walletName: string;
  quantity: number;
  averageCost: number;
  currentValue: number;
}

export interface AssetLots {
  assetSymbol: string;
  assetName: string;
  isCapital: boolean;
  currentPrice: number;
  quantity: number;
  invested: number;
  currentValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  lots: Lot[];
  untracked: UntrackedHolding[];
}

// target_value: llegar a un valor · gain_percent: ganar un % ·
// asset_quantity: juntar una cantidad de una moneda · target_price: que una
// moneda llegue a un precio (hacia arriba o hacia abajo).
export type GoalKind = 'target_value' | 'gain_percent' | 'asset_quantity' | 'target_price';
export type PriceDirection = 'above' | 'below';
export type GoalStatus = 'achieved' | 'in_progress' | 'expired';

export interface GoalProgress {
  status: GoalStatus;
  progress: number;
  current: number;
  target: number;
  targetValueEquivalent: number;
  remainingValue: number;
  daysLeft: number | null;
  neededPerMonth: number | null;
}

// A este ritmo (últimos 90 días), cuándo se cumple la meta.
export interface GoalProjection {
  // Cambio por mes de lo que mide la meta (valor, o cantidad de la moneda).
  perMonth: number;
  etaDate: string | null;
  // Con fecha límite: si llega a tiempo a este ritmo.
  onTime: boolean | null;
  basisDays: number;
}

export interface Goal {
  id: string;
  portfolioId: string;
  name: string;
  kind: GoalKind;
  assetSymbol: string | null;
  targetValue: number | null;
  targetPercent: number | null;
  targetQuantity: number | null;
  targetPrice: number | null;
  priceDirection: PriceDirection | null;
  deadline: string | null;
  completedAt: string | null;
  createdAt: string;
  progress: GoalProgress;
  projection: GoalProjection | null;
  // Lo que mide la meta por día (últimos 90 días + hoy), para el gráfico.
  history: { date: string; value: number }[];
}

export interface RebalanceRow {
  assetId: string;
  assetSymbol: string;
  currentValue: number;
  currentPercent: number;
  targetPercent: number | null;
  diffPercent: number | null;
  suggestedTrade: number | null;
}

export interface RebalancePlan {
  totalValue: number;
  targetsSum: number;
  rows: RebalanceRow[];
}

export type DcaFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface DcaProgress {
  periodsDue: number;
  plannedAmount: number;
  investedAmount: number;
  progress: number;
  nextDate: string | null;
  finished: boolean;
}

export interface DcaPlan {
  id: string;
  portfolioId: string;
  assetSymbol: string;
  amount: number;
  frequency: DcaFrequency;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  progress: DcaProgress;
}

export interface CompositionItem {
  assetId: string;
  assetSymbol: string;
  assetName: string;
  percent: number;
  isCapital: boolean;
  returnPercent: number | null;
}

export interface PublicPortfolio {
  id: string;
  alias: string;
  publishedAt: string;
  copies: number;
  returnPercent: number;
  changePercent24h: number;
  assetsCount: number;
  composition: CompositionItem[];
  hasInvestment: boolean;
}

export const GOAL_KIND_LABELS: Record<GoalKind, string> = {
  target_value: 'Llegar a un valor',
  gain_percent: 'Ganar un %',
  asset_quantity: 'Juntar una cantidad',
  target_price: 'Precio objetivo',
};

// Tipos que siempre son de una moneda.
export const ASSET_GOAL_KINDS: GoalKind[] = ['asset_quantity', 'target_price'];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  achieved: 'Cumplida',
  in_progress: 'En curso',
  expired: 'Vencida',
};

export const DCA_FREQUENCY_LABELS: Record<DcaFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Cada 2 semanas',
  monthly: 'Mensual',
};
