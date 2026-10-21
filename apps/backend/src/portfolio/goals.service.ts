import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { MarketService } from '../market/market.service';
import { PortfolioService } from './portfolio.service';
import {
  computeGoalProgress,
  goalHistory,
  priceSeries,
  priceDirectionFor,
  projectGoal,
  type GoalContext,
  type GoalKind,
  type GoalProgress,
  type GoalProjection,
  type PriceDirection,
  type SeriesPoint,
} from './goals';
import {
  ASSET_GOAL_KINDS,
  type CreateGoalDto,
  type GoalKindCode,
  type UpdateGoalDto,
} from './dto/goal.dto';

export interface GoalDto {
  id: string;
  portfolioId: string;
  name: string;
  kind: GoalKindCode;
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
  // A este ritmo, cuándo se cumple (null sin historia suficiente o en
  // metas de precio, que dependen del mercado).
  projection: GoalProjection | null;
  // Lo que mide la meta, por día (últimos 90 días + hoy), para el gráfico.
  history: { date: string; value: number }[];
}

interface GoalRow {
  id: string;
  portfolioId: string;
  assetId: string | null;
  name: string;
  kind: string;
  targetValue: number | null;
  targetPercent: number | null;
  targetQuantity: number | null;
  targetPrice: number | null;
  priceDirection: string | null;
  deadline: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

const DAY_MS = 86_400_000;
const PROJECTION_DAYS = 90;

// Historia diaria de un portafolio: valor total y, por activo, cantidad y
// valor (de los snapshots).
interface PortfolioHistory {
  total: SeriesPoint[];
  profitPercent: SeriesPoint[];
  assetValue: Map<string, SeriesPoint[]>;
  assetQuantity: Map<string, SeriesPoint[]>;
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly marketService: MarketService,
    private readonly portfolioService: PortfolioService,
  ) {}

  // Metas de un portafolio, o de todos con la vista General.
  async list(userId: string, portfolioId: string): Promise<GoalDto[]> {
    const ids = await this.portfolioService.resolveScope(userId, portfolioId);
    const goals = await this.prisma.investmentGoal.findMany({
      where: { portfolioId: { in: ids } },
      orderBy: { createdAt: 'asc' },
    });
    return this.withProgress(userId, goals);
  }

  // Usuarios con alguna meta (para los avisos de metas).
  async listUserIdsWithGoals(): Promise<string[]> {
    const rows = await this.prisma.portfolio.findMany({
      where: { investmentGoals: { some: {} } },
      select: { userId: true },
      distinct: ['userId'],
    });
    return rows.map((r) => r.userId);
  }

  async create(
    userId: string,
    portfolioId: string,
    dto: CreateGoalDto,
  ): Promise<GoalDto> {
    await this.portfolioService.findOwnedOrThrow(userId, portfolioId);
    const needsAsset = ASSET_GOAL_KINDS.includes(dto.kind);
    if (needsAsset && !dto.assetSymbol) {
      throw new BadRequestException('Esta meta necesita una moneda');
    }
    let assetId: string | null = null;
    let priceDirection: PriceDirection | null = null;
    if (dto.assetSymbol) {
      const asset = await this.marketService.getAssetBySymbol(dto.assetSymbol);
      if (!asset) {
        throw new BadRequestException(
          `Activo ${dto.assetSymbol} no encontrado en el catálogo`,
        );
      }
      assetId = asset.id;
      if (dto.kind === 'target_price') {
        priceDirection = await this.directionFor(asset.id, dto.targetPrice!);
      }
    }
    const goal = await this.prisma.investmentGoal.create({
      data: {
        portfolioId,
        assetId,
        name: dto.name,
        kind: dto.kind,
        targetValue: dto.kind === 'target_value' ? dto.targetValue : null,
        targetPercent: dto.kind === 'gain_percent' ? dto.targetPercent : null,
        targetQuantity:
          dto.kind === 'asset_quantity' ? dto.targetQuantity : null,
        targetPrice: dto.kind === 'target_price' ? dto.targetPrice : null,
        priceDirection,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      },
    });
    const [withProgress] = await this.withProgress(userId, [goal]);
    return withProgress;
  }

  // Editar nombre, objetivo y fecha. El tipo y la moneda no cambian (eso es
  // otra meta). Cambiar el precio objetivo vuelve a calcular hacia dónde se
  // espera que vaya y la deja pendiente otra vez.
  async update(
    userId: string,
    goalId: string,
    dto: UpdateGoalDto,
  ): Promise<GoalDto> {
    const goal = await this.findOwnedOrThrow(userId, goalId);
    const priceChange =
      dto.targetPrice !== undefined &&
      goal.kind === 'target_price' &&
      goal.assetId
        ? {
            targetPrice: dto.targetPrice,
            priceDirection: await this.directionFor(
              goal.assetId,
              dto.targetPrice,
            ),
            completedAt: null,
          }
        : {};
    const updated = await this.prisma.investmentGoal.update({
      where: { id: goal.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.targetValue !== undefined && goal.kind === 'target_value'
          ? { targetValue: dto.targetValue }
          : {}),
        ...(dto.targetPercent !== undefined && goal.kind === 'gain_percent'
          ? { targetPercent: dto.targetPercent }
          : {}),
        ...(dto.targetQuantity !== undefined && goal.kind === 'asset_quantity'
          ? { targetQuantity: dto.targetQuantity }
          : {}),
        ...priceChange,
        ...(dto.deadline !== undefined
          ? { deadline: dto.deadline ? new Date(dto.deadline) : null }
          : {}),
        updatedAt: new Date(),
      },
    });
    const [withProgress] = await this.withProgress(userId, [updated]);
    return withProgress;
  }

  async remove(userId: string, goalId: string): Promise<void> {
    const goal = await this.findOwnedOrThrow(userId, goalId);
    await this.prisma.investmentGoal.delete({ where: { id: goal.id } });
  }

  private async directionFor(
    assetId: string,
    targetPrice: number,
  ): Promise<PriceDirection> {
    const price = (await this.marketService.getPricesByAssetIds([assetId])).get(
      assetId,
    )?.price;
    if (!price) {
      throw new BadRequestException(
        'Esa moneda no tiene precio de mercado para seguir la meta',
      );
    }
    return priceDirectionFor(price, targetPrice);
  }

  private async findOwnedOrThrow(userId: string, goalId: string) {
    const goal = await this.prisma.investmentGoal.findFirst({
      where: { id: goalId, portfolio: { userId } },
    });
    if (!goal) throw new NotFoundException('Meta no encontrada');
    return goal;
  }

  private async history(
    portfolioIds: string[],
  ): Promise<Map<string, PortfolioHistory>> {
    const since = new Date(Date.now() - PROJECTION_DAYS * DAY_MS);
    const snapshots = await this.prisma.portfolioSnapshot.findMany({
      where: {
        portfolioId: { in: portfolioIds },
        snapshotDate: { gte: since },
      },
      include: { items: true },
      orderBy: { snapshotDate: 'asc' },
    });
    const out = new Map<string, PortfolioHistory>();
    for (const s of snapshots) {
      let h = out.get(s.portfolioId);
      if (!h) {
        h = {
          total: [],
          profitPercent: [],
          assetValue: new Map(),
          assetQuantity: new Map(),
        };
        out.set(s.portfolioId, h);
      }
      h.total.push({ date: s.snapshotDate, value: s.totalValue });
      h.profitPercent.push({ date: s.snapshotDate, value: s.profitPercent });
      for (const item of s.items) {
        const push = (m: Map<string, SeriesPoint[]>, value: number) =>
          m.set(item.assetId, [
            ...(m.get(item.assetId) ?? []),
            { date: s.snapshotDate, value },
          ]);
        push(h.assetValue, item.value);
        push(h.assetQuantity, item.quantity);
      }
    }
    return out;
  }

  // Calcula el progreso y la proyección de cada meta con los números
  // actuales de su portafolio (o del activo, si la meta es de un activo).
  private async withProgress(
    userId: string,
    goals: GoalRow[],
  ): Promise<GoalDto[]> {
    if (goals.length === 0) return [];
    const now = new Date();
    const portfolioIds = [...new Set(goals.map((g) => g.portfolioId))];
    const assetIds = [
      ...new Set(goals.map((g) => g.assetId).filter((a): a is string => !!a)),
    ];
    const [assets, prices, history, data] = await Promise.all([
      this.marketService.getAssetsByIds(assetIds),
      this.marketService.getPricesByAssetIds(assetIds),
      this.history(portfolioIds),
      Promise.all(
        portfolioIds.map(async (id) => ({
          id,
          summary: await this.portfolioService.getSummary(userId, id),
          positions: await this.portfolioService.getPositions(userId, id),
        })),
      ),
    ]);
    const byPortfolio = new Map(data.map((d) => [d.id, d]));
    const newlyCompleted: string[] = [];

    const result = goals.map((goal) => {
      const { summary, positions } = byPortfolio.get(goal.portfolioId)!;
      const kind = goal.kind as GoalKind;
      const assetSymbol = goal.assetId
        ? (assets.get(goal.assetId)?.symbol ?? null)
        : null;

      let ctx: GoalContext;
      if (assetSymbol) {
        const own = positions.filter((p) => p.assetSymbol === assetSymbol);
        const sum = (pick: (p: (typeof own)[number]) => number) =>
          own.reduce((acc, p) => acc + pick(p), 0);
        ctx = {
          now,
          currentValue: sum((p) => p.currentValue),
          invested: sum((p) => p.quantity * p.averageCost),
          gain: sum((p) => p.unrealizedPnl + p.realizedPnl),
          quantity: sum((p) => p.quantity),
          price: prices.get(goal.assetId!)?.price ?? 0,
        };
      } else {
        // El valor del portafolio ya no incluye el capital.
        ctx = {
          now,
          currentValue: summary.totalValue,
          invested: summary.totalInvested,
          gain: summary.unrealizedPnl + summary.realizedPnl,
          quantity: 0,
          price: 0,
        };
      }

      const progress = computeGoalProgress(
        {
          kind,
          targetValue: goal.targetValue,
          targetPercent: goal.targetPercent,
          targetQuantity: goal.targetQuantity,
          targetPrice: goal.targetPrice,
          priceDirection: goal.priceDirection as PriceDirection | null,
          deadline: goal.deadline,
          completedAt: goal.completedAt,
        },
        ctx,
      );
      let completedAt = goal.completedAt;
      if (
        kind === 'target_price' &&
        progress.status === 'achieved' &&
        !completedAt
      ) {
        completedAt = now;
        newlyCompleted.push(goal.id);
      }

      const h = history.get(goal.portfolioId);
      let projection: GoalProjection | null = null;
      if (h && kind !== 'target_price' && progress.status !== 'achieved') {
        const series =
          kind === 'asset_quantity'
            ? (h.assetQuantity.get(goal.assetId!) ?? [])
            : goal.assetId
              ? (h.assetValue.get(goal.assetId) ?? [])
              : h.total;
        const [current, target] =
          kind === 'asset_quantity'
            ? [ctx.quantity, progress.target]
            : [ctx.currentValue, progress.targetValueEquivalent];
        projection = projectGoal(series, current, target, now, goal.deadline);
      }

      // Serie de lo que mide la meta (valor, %, cantidad o precio).
      const assetValues = goal.assetId
        ? (h?.assetValue.get(goal.assetId) ?? [])
        : [];
      const assetQuantities = goal.assetId
        ? (h?.assetQuantity.get(goal.assetId) ?? [])
        : [];
      const metricSeries =
        kind === 'target_value'
          ? goal.assetId
            ? assetValues
            : (h?.total ?? [])
          : kind === 'gain_percent'
            ? goal.assetId
              ? []
              : (h?.profitPercent ?? [])
            : kind === 'asset_quantity'
              ? assetQuantities
              : priceSeries(assetValues, assetQuantities);

      return {
        id: goal.id,
        portfolioId: goal.portfolioId,
        name: goal.name,
        kind: goal.kind as GoalKindCode,
        assetSymbol,
        targetValue: goal.targetValue,
        targetPercent: goal.targetPercent,
        targetQuantity: goal.targetQuantity,
        targetPrice: goal.targetPrice,
        priceDirection: goal.priceDirection as PriceDirection | null,
        deadline: goal.deadline?.toISOString() ?? null,
        completedAt: completedAt?.toISOString() ?? null,
        createdAt: goal.createdAt.toISOString(),
        progress,
        projection,
        history: goalHistory(metricSeries, progress.current, now),
      };
    });

    // Una meta de precio que tocó el objetivo queda cumplida aunque después
    // el precio vuelva.
    if (newlyCompleted.length > 0) {
      await this.prisma.investmentGoal.updateMany({
        where: { id: { in: newlyCompleted }, completedAt: null },
        data: { completedAt: now, isCompleted: true },
      });
    }
    return result;
  }
}
