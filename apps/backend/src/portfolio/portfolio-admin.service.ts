import { Injectable, NotFoundException } from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';

const DAY_MS = 86_400_000;

export interface PortfolioMetrics {
  portfolios: number;
  publicPortfolios: number;
  copies: number;
  transactions: number;
  transactionsLast30Days: number;
  exchangeAccounts: number;
  exchangeAccountsSyncing: number;
  goals: number;
  activeDcaPlans: number;
}

export interface AdminPublicPortfolio {
  id: string;
  name: string;
  alias: string | null;
  userId: string;
  publishedAt: Date | null;
  copies: number;
}

export interface UserPortfolioCounts {
  portfolios: number;
  exchangeAccounts: number;
}

// Lecturas agregadas y moderación sobre la base Portfolio, para el panel
// de administración. No devuelve montos de nadie.
@Injectable()
export class PortfolioAdminService {
  constructor(private readonly prisma: PortfolioPrismaService) {}

  async metrics(now = new Date()): Promise<PortfolioMetrics> {
    const since = new Date(now.getTime() - 30 * DAY_MS);
    const [
      portfolios,
      publicPortfolios,
      copies,
      transactions,
      transactionsLast30Days,
      exchangeAccounts,
      exchangeAccountsSyncing,
      goals,
      activeDcaPlans,
    ] = await Promise.all([
      this.prisma.portfolio.count(),
      this.prisma.portfolio.count({ where: { isPublic: true } }),
      this.prisma.portfolio.count({ where: { copiedFromId: { not: null } } }),
      this.prisma.transaction.count(),
      this.prisma.transaction.count({ where: { createdAt: { gte: since } } }),
      this.prisma.exchangeAccount.count(),
      this.prisma.exchangeAccount.count({ where: { syncEnabled: true } }),
      this.prisma.investmentGoal.count(),
      this.prisma.dcaPlan.count({ where: { isActive: true } }),
    ]);
    return {
      portfolios,
      publicPortfolios,
      copies,
      transactions,
      transactionsLast30Days,
      exchangeAccounts,
      exchangeAccountsSyncing,
      goals,
      activeDcaPlans,
    };
  }

  async countsByUser(
    userIds: string[],
  ): Promise<Map<string, UserPortfolioCounts>> {
    if (userIds.length === 0) return new Map();
    const [portfolios, accounts] = await Promise.all([
      this.prisma.portfolio.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
      this.prisma.exchangeAccount.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      }),
    ]);
    const result = new Map<string, UserPortfolioCounts>(
      userIds.map((id) => [id, { portfolios: 0, exchangeAccounts: 0 }]),
    );
    for (const p of portfolios)
      result.get(p.userId)!.portfolios = p._count._all;
    for (const a of accounts)
      result.get(a.userId)!.exchangeAccounts = a._count._all;
    return result;
  }

  async listPublic(): Promise<AdminPublicPortfolio[]> {
    const rows = await this.prisma.portfolio.findMany({
      where: { isPublic: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        name: true,
        publicAlias: true,
        userId: true,
        publishedAt: true,
      },
    });
    const copies = await this.prisma.portfolio.groupBy({
      by: ['copiedFromId'],
      where: { copiedFromId: { in: rows.map((r) => r.id) } },
      _count: { _all: true },
    });
    const copiesById = new Map(
      copies.map((c) => [c.copiedFromId!, c._count._all]),
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      alias: r.publicAlias,
      userId: r.userId,
      publishedAt: r.publishedAt,
      copies: copiesById.get(r.id) ?? 0,
    }));
  }

  // Lo saca del ranking y borra el alias: si el dueño lo vuelve a
  // publicar, tiene que elegir otro.
  async unpublish(portfolioId: string): Promise<void> {
    const { count } = await this.prisma.portfolio.updateMany({
      where: { id: portfolioId, isPublic: true },
      data: {
        isPublic: false,
        publishedAt: null,
        publicAlias: null,
        updatedAt: new Date(),
      },
    });
    if (count === 0) {
      throw new NotFoundException('Ese portafolio no está publicado');
    }
  }
}
