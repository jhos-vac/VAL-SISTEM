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

export type GoalKind = 'target_value' | 'gain_percent';
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

export interface Goal {
  id: string;
  portfolioId: string;
  name: string;
  kind: GoalKind;
  assetSymbol: string | null;
  targetValue: number | null;
  targetPercent: number | null;
  deadline: string | null;
  createdAt: string;
  progress: GoalProgress;
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
