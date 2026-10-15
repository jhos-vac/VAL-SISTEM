// Contratos del panel de administración (solo rol admin).

export interface AdminOverview {
  users: {
    total: number;
    suspended: number;
    admins: number;
    newLast7Days: number;
    newLast30Days: number;
    activeLast7Days: number;
    activeLast30Days: number;
    signupsByDay: { date: string; count: number }[];
  };
  portfolios: {
    portfolios: number;
    publicPortfolios: number;
    copies: number;
    transactions: number;
    transactionsLast30Days: number;
    exchangeAccounts: number;
    exchangeAccountsSyncing: number;
    goals: number;
    activeDcaPlans: number;
  };
}

export type AdminUserStatus = "Active" | "Suspended";

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  status: string;
  emailVerified: boolean;
  roles: string[];
  createdAt: string;
  lastLoginAt: string | null;
  portfolios: number;
  exchangeAccounts: number;
}

export interface AdminUserPage {
  total: number;
  page: number;
  pageSize: number;
  items: AdminUser[];
}

export type JobState = "ok" | "failed" | "late" | "never";

export interface AdminJobHealth {
  name: string;
  everyMs: number;
  state: JobState;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
}

export interface AdminHealth {
  checkedAt: string;
  uptimeSeconds: number;
  jobs: AdminJobHealth[];
  market: { lastUpdatedAt: string | null; tickers: number };
  failures: {
    failed24h: number;
    total24h: number;
    items: {
      method: string;
      path: string;
      message: string | null;
      userId: string | null;
      createdAt: string;
    }[];
  };
}

export interface AdminPublicPortfolio {
  id: string;
  name: string;
  alias: string | null;
  userId: string;
  ownerEmail: string | null;
  publishedAt: string | null;
  copies: number;
}

export const JOB_LABELS: Record<string, string> = {
  "market.ticker-sync": "Precios de Binance",
  "exchange.account-sync": "Sync de cuentas Binance",
  "portfolio.snapshots": "Snapshots de portafolios",
  "account.purge-closed": "Limpieza de cuentas cerradas",
};

export const JOB_STATE_LABELS: Record<JobState, string> = {
  ok: "Al día",
  failed: "Falló",
  late: "Atrasado",
  never: "Sin corridas",
};
