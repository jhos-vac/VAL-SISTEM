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
  type GoalContext,
  type GoalKind,
  type GoalProgress,
} from './goals';
import type {
  CreateGoalDto,
  GoalKindCode,
  UpdateGoalDto,
} from './dto/goal.dto';

export interface GoalDto {
  id: string;
  portfolioId: string;
  name: string;
  kind: GoalKindCode;
  assetSymbol: string | null;
  targetValue: number | null;
  targetPercent: number | null;
  deadline: string | null;
  createdAt: string;
  progress: GoalProgress;
}

interface GoalRow {
  id: string;
  portfolioId: string;
  assetId: string | null;
  name: string;
  kind: string;
  targetValue: number | null;
  targetPercent: number | null;
  deadline: Date | null;
  createdAt: Date;
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

  async create(
    userId: string,
    portfolioId: string,
    dto: CreateGoalDto,
  ): Promise<GoalDto> {
    await this.portfolioService.findOwnedOrThrow(userId, portfolioId);
    let assetId: string | null = null;
    if (dto.assetSymbol) {
      const asset = await this.marketService.getAssetBySymbol(dto.assetSymbol);
      if (!asset) {
        throw new BadRequestException(
          `Activo ${dto.assetSymbol} no encontrado en el catálogo`,
        );
      }
      assetId = asset.id;
    }
    const goal = await this.prisma.investmentGoal.create({
      data: {
        portfolioId,
        assetId,
        name: dto.name,
        kind: dto.kind,
        targetValue: dto.kind === 'target_value' ? dto.targetValue : null,
        targetPercent: dto.kind === 'gain_percent' ? dto.targetPercent : null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      },
    });
    const [withProgress] = await this.withProgress(userId, [goal]);
    return withProgress;
  }

  async update(
    userId: string,
    goalId: string,
    dto: UpdateGoalDto,
  ): Promise<GoalDto> {
    const goal = await this.findOwnedOrThrow(userId, goalId);
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

  private async findOwnedOrThrow(userId: string, goalId: string) {
    const goal = await this.prisma.investmentGoal.findFirst({
      where: { id: goalId, portfolio: { userId } },
    });
    if (!goal) throw new NotFoundException('Meta no encontrada');
    return goal;
  }

  // Calcula el progreso de cada meta con los números actuales de su
  // portafolio (o del activo, si la meta es de un activo).
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
    const [assets, data] = await Promise.all([
      this.marketService.getAssetsByIds(assetIds),
      Promise.all(
        portfolioIds.map(async (id) => ({
          id,
          summary: await this.portfolioService.getSummary(userId, id),
          positions: await this.portfolioService.getPositions(userId, id),
        })),
      ),
    ]);
    const byPortfolio = new Map(data.map((d) => [d.id, d]));

    return goals.map((goal) => {
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
        };
      } else {
        // El valor del portafolio ya no incluye el capital.
        ctx = {
          now,
          currentValue: summary.totalValue,
          invested: summary.totalInvested,
          gain: summary.unrealizedPnl + summary.realizedPnl,
        };
      }

      return {
        id: goal.id,
        portfolioId: goal.portfolioId,
        name: goal.name,
        kind: goal.kind as GoalKindCode,
        assetSymbol,
        targetValue: goal.targetValue,
        targetPercent: goal.targetPercent,
        deadline: goal.deadline?.toISOString() ?? null,
        createdAt: goal.createdAt.toISOString(),
        progress: computeGoalProgress(
          {
            kind,
            targetValue: goal.targetValue,
            targetPercent: goal.targetPercent,
            deadline: goal.deadline,
          },
          ctx,
        ),
      };
    });
  }
}
