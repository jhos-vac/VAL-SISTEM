import { Injectable } from '@nestjs/common';
import {
  UserAdminService,
  type AdminUserStatus,
} from '../users/user-admin.service';
import { PortfolioAdminService } from '../portfolio/portfolio-admin.service';
import { MarketService } from '../market/market.service';
import { JobLeaseService } from '../jobs/job-lease.service';
import { JobsService } from '../jobs/jobs.service';
import { jobHealth } from './job-health';

// Panel de administración: junta lo que expone cada dominio por su API
// pública (Identity, Portfolio, Market, Jobs). No toca bases directamente.
@Injectable()
export class AdminService {
  constructor(
    private readonly users: UserAdminService,
    private readonly portfolios: PortfolioAdminService,
    private readonly market: MarketService,
    private readonly leases: JobLeaseService,
    private readonly jobs: JobsService,
  ) {}

  async overview() {
    const [users, portfolios] = await Promise.all([
      this.users.metrics(),
      this.portfolios.metrics(),
    ]);
    return { users, portfolios };
  }

  async listUsers(filters: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const { items, total } = await this.users.listUsers({
      ...filters,
      page,
      pageSize,
    });
    const counts = await this.portfolios.countsByUser(items.map((u) => u.id));
    return {
      total,
      page,
      pageSize,
      items: items.map((u) => ({
        ...u,
        portfolios: counts.get(u.id)?.portfolios ?? 0,
        exchangeAccounts: counts.get(u.id)?.exchangeAccounts ?? 0,
      })),
    };
  }

  setUserStatus(actorId: string, userId: string, status: AdminUserStatus) {
    return this.users.setStatus(actorId, userId, status);
  }

  async health() {
    const now = new Date();
    const [statuses, market, failures] = await Promise.all([
      this.leases.listStatus(),
      this.market.tickerFreshness(),
      this.users.recentFailures(),
    ]);
    return {
      checkedAt: now,
      uptimeSeconds: Math.round(process.uptime()),
      jobs: jobHealth(this.jobs.schedule(), statuses, now),
      market,
      failures,
    };
  }

  async listPublicPortfolios() {
    const rows = await this.portfolios.listPublic();
    const emails = await this.users.emailsByIds([
      ...new Set(rows.map((r) => r.userId)),
    ]);
    return rows.map((r) => ({
      ...r,
      ownerEmail: emails.get(r.userId) ?? null,
    }));
  }

  unpublish(portfolioId: string) {
    return this.portfolios.unpublish(portfolioId);
  }
}
