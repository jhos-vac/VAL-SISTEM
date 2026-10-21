import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { MarketService } from '../market/market.service';
import { PortfolioService } from './portfolio.service';
import {
  computeDcaProgress,
  computeRebalance,
  type DcaFrequency,
  type DcaProgress,
  type RebalancePlan,
} from './strategy';
import type {
  CreateDcaPlanDto,
  TargetAllocationItemDto,
  UpdateDcaPlanDto,
} from './dto/strategy.dto';

export interface DcaPlanDto {
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

interface DcaPlanRow {
  id: string;
  portfolioId: string;
  assetId: string;
  amount: number;
  frequency: string;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
}

const MAX_TOTAL_PERCENT = 100.0001;

@Injectable()
export class StrategyService {
  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly marketService: MarketService,
    private readonly portfolioService: PortfolioService,
  ) {}

  // --- Asignación objetivo ---

  async getTargetAllocation(
    userId: string,
    portfolioId: string,
  ): Promise<RebalancePlan> {
    await this.portfolioService.findOwnedOrThrow(userId, portfolioId);
    const [allTargets, positions, capital] = await Promise.all([
      this.prisma.targetAllocation.findMany({ where: { portfolioId } }),
      this.portfolioService.getPositions(userId, portfolioId),
      this.portfolioService.getCapitalAssetIds(userId),
    ]);
    // El capital (p.ej. USDT) no forma parte del portafolio ni de la
    // estrategia, aunque haya quedado un objetivo guardado de antes.
    const targets = allTargets.filter((t) => !capital.has(t.assetId));
    const assets = await this.marketService.getAssetsByIds(
      targets.map((t) => t.assetId),
    );
    const idBySymbol = new Map(
      [...assets.entries()].map(([id, a]) => [a.symbol, id]),
    );

    return computeRebalance(
      targets.map((t) => ({
        assetId: t.assetId,
        assetSymbol: assets.get(t.assetId)?.symbol ?? '???',
        targetPercent: t.targetPercent,
      })),
      // El valor total incluye el capital: es el dinero disponible para
      // rebalancear (p.ej. un objetivo de 20 % en USDT).
      positions.map((p) => ({
        assetId: idBySymbol.get(p.assetSymbol) ?? p.assetSymbol,
        assetSymbol: p.assetSymbol,
        value: p.currentValue,
      })),
    );
  }

  async setTargetAllocation(
    userId: string,
    portfolioId: string,
    items: TargetAllocationItemDto[],
  ): Promise<RebalancePlan> {
    await this.portfolioService.findOwnedOrThrow(userId, portfolioId);
    const rows = await this.resolveTargets(items);
    const capital = await this.portfolioService.getCapitalAssetIds(userId);
    if (rows.some((r) => capital.has(r.assetId))) {
      throw new BadRequestException(
        'Las monedas capital no forman parte de la estrategia. Quitálas de la asignación.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.targetAllocation.deleteMany({ where: { portfolioId } }),
      this.prisma.targetAllocation.createMany({
        data: rows.map((r) => ({ portfolioId, ...r })),
      }),
    ]);
    return this.getTargetAllocation(userId, portfolioId);
  }

  // Valida los objetivos (activos existentes, sin repetir, suma ≤ 100 %) y
  // los traduce a assetId. También lo usa la copia de portafolios públicos.
  async resolveTargets(
    items: Array<{ assetSymbol: string; targetPercent: number }>,
  ): Promise<Array<{ assetId: string; targetPercent: number }>> {
    const symbols = items.map((i) => i.assetSymbol.trim().toUpperCase());
    if (new Set(symbols).size !== symbols.length) {
      throw new BadRequestException('Hay activos repetidos en la asignación');
    }
    const total = items.reduce((sum, i) => sum + i.targetPercent, 0);
    if (total > MAX_TOTAL_PERCENT) {
      throw new BadRequestException(
        `La asignación suma ${total.toFixed(2)} %; no puede pasar de 100 %`,
      );
    }
    const catalog = await this.marketService.getAssets();
    const idBySymbol = new Map(catalog.map((a) => [a.symbol, a.id]));
    const unknown = symbols.filter((s) => !idBySymbol.has(s));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Activo(s) no encontrado(s) en el catálogo: ${unknown.join(', ')}`,
      );
    }
    return items.map((item, i) => ({
      assetId: idBySymbol.get(symbols[i])!,
      targetPercent: item.targetPercent,
    }));
  }

  // --- Planes de compra periódica (DCA) ---

  // Usuarios con algún plan de compras activo (para el aviso "hoy toca").
  async listUserIdsWithActiveDca(): Promise<string[]> {
    const rows = await this.prisma.portfolio.findMany({
      where: { dcaPlans: { some: { isActive: true } } },
      select: { userId: true },
      distinct: ['userId'],
    });
    return rows.map((r) => r.userId);
  }

  async listDcaPlans(
    userId: string,
    portfolioId: string,
  ): Promise<DcaPlanDto[]> {
    const ids = await this.portfolioService.resolveScope(userId, portfolioId);
    const plans = await this.prisma.dcaPlan.findMany({
      where: { portfolioId: { in: ids } },
      orderBy: { createdAt: 'asc' },
    });
    return this.withDcaProgress(plans);
  }

  async createDcaPlan(
    userId: string,
    portfolioId: string,
    dto: CreateDcaPlanDto,
  ): Promise<DcaPlanDto> {
    await this.portfolioService.findOwnedOrThrow(userId, portfolioId);
    const asset = await this.marketService.getAssetBySymbol(dto.assetSymbol);
    if (!asset) {
      throw new BadRequestException(
        `Activo ${dto.assetSymbol} no encontrado en el catálogo`,
      );
    }
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('La fecha de fin es anterior al inicio');
    }
    const plan = await this.prisma.dcaPlan.create({
      data: {
        portfolioId,
        assetId: asset.id,
        amount: dto.amount,
        frequency: dto.frequency,
        startDate,
        endDate,
      },
    });
    const [withProgress] = await this.withDcaProgress([plan]);
    return withProgress;
  }

  async updateDcaPlan(
    userId: string,
    planId: string,
    dto: UpdateDcaPlanDto,
  ): Promise<DcaPlanDto> {
    const plan = await this.findOwnedPlanOrThrow(userId, planId);
    const updated = await this.prisma.dcaPlan.update({
      where: { id: plan.id },
      data: {
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
        updatedAt: new Date(),
      },
    });
    const [withProgress] = await this.withDcaProgress([updated]);
    return withProgress;
  }

  async deleteDcaPlan(userId: string, planId: string): Promise<void> {
    const plan = await this.findOwnedPlanOrThrow(userId, planId);
    await this.prisma.dcaPlan.delete({ where: { id: plan.id } });
  }

  private async findOwnedPlanOrThrow(userId: string, planId: string) {
    const plan = await this.prisma.dcaPlan.findFirst({
      where: { id: planId, portfolio: { userId } },
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return plan;
  }

  // Compras reales del activo en el portafolio del plan, en cualquier
  // wallet (manual o de exchange).
  private async withDcaProgress(plans: DcaPlanRow[]): Promise<DcaPlanDto[]> {
    if (plans.length === 0) return [];
    const now = new Date();
    const assets = await this.marketService.getAssetsByIds([
      ...new Set(plans.map((p) => p.assetId)),
    ]);
    return Promise.all(
      plans.map(async (plan) => {
        const buys = await this.prisma.transaction.findMany({
          where: {
            transactionType: { code: 'buy' },
            executedAt: { gte: plan.startDate },
            assetPosition: {
              assetId: plan.assetId,
              wallet: { portfolioId: plan.portfolioId },
            },
          },
          select: { executedAt: true, total: true },
        });
        return {
          id: plan.id,
          portfolioId: plan.portfolioId,
          assetSymbol: assets.get(plan.assetId)?.symbol ?? '???',
          amount: plan.amount,
          frequency: plan.frequency as DcaFrequency,
          startDate: plan.startDate.toISOString(),
          endDate: plan.endDate?.toISOString() ?? null,
          isActive: plan.isActive,
          progress: computeDcaProgress(
            {
              amount: plan.amount,
              frequency: plan.frequency as DcaFrequency,
              startDate: plan.startDate,
              endDate: plan.endDate,
            },
            buys,
            now,
          ),
        };
      }),
    );
  }
}
