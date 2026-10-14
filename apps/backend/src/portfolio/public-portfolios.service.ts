import { Injectable, NotFoundException } from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { lockForTransaction } from '../common/db/advisory-lock';
import { PortfolioService, type PortfolioDto } from './portfolio.service';
import {
  buildPublicStats,
  compositionToTargets,
  type PublicStats,
} from './public-view';
import type {
  CopyPortfolioDto,
  SetPublicationDto,
} from './dto/public-portfolio.dto';

export interface PublicPortfolioDto extends PublicStats {
  id: string;
  alias: string;
  publishedAt: string;
  // Cuántas veces se copió (señal de interés para el ranking).
  copies: number;
}

// Cuántos portafolios públicos se evalúan por pedido.
const MAX_PUBLIC = 100;
// El ranking se recalcula como mucho cada este tiempo (cálculo pesado:
// precio de cada posición de cada portafolio público).
const CACHE_TTL_MS = 2 * 60 * 1000;

// Ranking de portafolios que sus dueños decidieron publicar, y copia de su
// composición. Solo se exponen porcentajes (ver public-view.ts).
@Injectable()
export class PublicPortfoliosService {
  private cache: { at: number; items: PublicPortfolioDto[] } | null = null;

  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly portfolioService: PortfolioService,
  ) {}

  async setPublication(
    userId: string,
    portfolioId: string,
    dto: SetPublicationDto,
  ): Promise<PortfolioDto> {
    const portfolio = await this.portfolioService.findOwnedOrThrow(
      userId,
      portfolioId,
    );
    await this.prisma.portfolio.update({
      where: { id: portfolio.id },
      data: dto.isPublic
        ? {
            isPublic: true,
            publicAlias: dto.alias!.trim(),
            publishedAt: portfolio.publishedAt ?? new Date(),
          }
        : { isPublic: false, publishedAt: null },
    });
    this.cache = null;
    return this.portfolioService.get(userId, portfolioId);
  }

  // Ranking por rendimiento sobre lo invertido. Los portafolios sin nada
  // invertido (vacíos o solo capital) no entran.
  async ranking(): Promise<PublicPortfolioDto[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.items;
    }
    const portfolios = await this.prisma.portfolio.findMany({
      where: { isPublic: true },
      orderBy: { publishedAt: 'desc' },
      take: MAX_PUBLIC,
    });
    const copies = await this.copyCounts(portfolios.map((p) => p.id));
    const items: PublicPortfolioDto[] = [];
    for (const p of portfolios) {
      const stats = buildPublicStats(
        await this.portfolioService.getEnrichedPositionsForSnapshot(p.id),
      );
      if (!stats.hasInvestment) continue;
      items.push(this.toDto(p, stats, copies.get(p.id) ?? 0));
    }
    items.sort((a, b) => b.returnPercent - a.returnPercent);
    this.cache = { at: Date.now(), items };
    return items;
  }

  async detail(publicId: string): Promise<PublicPortfolioDto> {
    const portfolio = await this.findPublicOrThrow(publicId);
    const [stats, copies] = await Promise.all([
      this.portfolioService
        .getEnrichedPositionsForSnapshot(portfolio.id)
        .then(buildPublicStats),
      this.copyCounts([portfolio.id]),
    ]);
    return this.toDto(portfolio, stats, copies.get(portfolio.id) ?? 0);
  }

  // Copia = un portafolio nuevo del usuario, vacío, con la composición del
  // público como asignación objetivo: la estrategia le dice qué comprar.
  // Portafolio y asignación se crean juntos, en una transacción.
  async copy(
    userId: string,
    publicId: string,
    dto: CopyPortfolioDto,
  ): Promise<PortfolioDto> {
    const source = await this.findPublicOrThrow(publicId);
    const stats = buildPublicStats(
      await this.portfolioService.getEnrichedPositionsForSnapshot(source.id),
    );
    const targets = compositionToTargets(stats.composition);

    const created = await this.prisma.$transaction(async (tx) => {
      await lockForTransaction(tx, `portfolios:${userId}`);
      const isFirst = (await tx.portfolio.count({ where: { userId } })) === 0;
      const portfolio = await tx.portfolio.create({
        data: {
          userId,
          name: dto.name,
          description: `Copia de "${source.publicAlias ?? 'portafolio público'}"`,
          baseCurrency: (dto.baseCurrency ?? source.baseCurrency).toUpperCase(),
          isDefault: isFirst,
          copiedFromId: source.id,
        },
      });
      if (targets.length > 0) {
        await tx.targetAllocation.createMany({
          data: targets.map((t) => ({ portfolioId: portfolio.id, ...t })),
        });
      }
      return portfolio;
    });
    this.cache = null;
    return this.portfolioService.get(userId, created.id);
  }

  private async findPublicOrThrow(publicId: string) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: publicId, isPublic: true },
    });
    if (!portfolio) throw new NotFoundException('Portafolio no encontrado');
    return portfolio;
  }

  private async copyCounts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.portfolio.groupBy({
      by: ['copiedFromId'],
      where: { copiedFromId: { in: ids } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.copiedFromId!, r._count._all]));
  }

  private toDto(
    p: { id: string; publicAlias: string | null; publishedAt: Date | null },
    stats: PublicStats,
    copies: number,
  ): PublicPortfolioDto {
    return {
      id: p.id,
      alias: p.publicAlias ?? 'Portafolio',
      publishedAt: (p.publishedAt ?? new Date()).toISOString(),
      copies,
      ...stats,
    };
  }
}
