import { Injectable, NotFoundException } from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { MarketService } from '../market/market.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';

export interface PortfolioDto {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  baseCurrency: string;
}

export interface AssetPositionDto {
  id: string;
  portfolioId: string;
  walletId: string;
  assetSymbol: string;
  assetName: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  currentValue: number;
  realizedPnl: number;
  unrealizedPnl: number;
}

export interface EnrichedPosition extends AssetPositionDto {
  changePercent24h: number;
  assetId: string;
}

export interface PortfolioSummaryDto {
  portfolioId: string;
  totalValue: number;
  totalInvested: number;
  realizedPnl: number;
  unrealizedPnl: number;
  changePercent24h: number;
  asOf: string;
}

export interface AssetAllocationDto {
  assetSymbol: string;
  assetName: string;
  valueInBaseCurrency: number;
  percentage: number;
}

export interface PerformancePointDto {
  date: string;
  totalValue: number;
}

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly marketService: MarketService,
  ) {}

  private toDto(p: {
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
    baseCurrency: string;
  }): PortfolioDto {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      isDefault: p.isDefault,
      baseCurrency: p.baseCurrency,
    };
  }

  // Todo endpoint de portafolio/wallet/transacción pasa por acá para
  // resolver "¿es de este usuario?" en una sola query — si no es dueño,
  // 404 (no 403) para no filtrar si el id existe o no.
  async findOwnedOrThrow(userId: string, portfolioId: string) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });
    if (!portfolio) {
      throw new NotFoundException('Portafolio no encontrado');
    }
    return portfolio;
  }

  async create(userId: string, dto: CreatePortfolioDto): Promise<PortfolioDto> {
    const isFirst =
      (await this.prisma.portfolio.count({ where: { userId } })) === 0;
    const makeDefault = isFirst || dto.isDefault === true;

    const portfolio = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.portfolio.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.portfolio.create({
        data: {
          userId,
          name: dto.name,
          description: dto.description ?? '',
          baseCurrency: dto.baseCurrency.toUpperCase(),
          isDefault: makeDefault,
        },
      });
    });

    return this.toDto(portfolio);
  }

  async list(userId: string): Promise<PortfolioDto[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return portfolios.map((p) => this.toDto(p));
  }

  async get(userId: string, portfolioId: string): Promise<PortfolioDto> {
    return this.toDto(await this.findOwnedOrThrow(userId, portfolioId));
  }

  async update(
    userId: string,
    portfolioId: string,
    dto: UpdatePortfolioDto,
  ): Promise<PortfolioDto> {
    await this.findOwnedOrThrow(userId, portfolioId);

    const portfolio = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.portfolio.updateMany({
          where: { userId, isDefault: true, NOT: { id: portfolioId } },
          data: { isDefault: false },
        });
      }
      return tx.portfolio.update({
        where: { id: portfolioId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.baseCurrency !== undefined
            ? { baseCurrency: dto.baseCurrency.toUpperCase() }
            : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          updatedAt: new Date(),
        },
      });
    });

    return this.toDto(portfolio);
  }

  // Posiciones activas (quantity > 0) de un portafolio, enriquecidas con
  // precio actual desde Market (llamada de método directa, no HTTP — ver
  // comentario en market.service.ts). Si un activo todavía no tiene
  // ticker sincronizado, cae al averageCost como precio (unrealizedPnl=0,
  // changePercent24h=0) en vez de romper la respuesta.
  private async getEnrichedPositions(
    userId: string,
    portfolioId: string,
  ): Promise<EnrichedPosition[]> {
    await this.findOwnedOrThrow(userId, portfolioId);
    return this.getEnrichedPositionsForSnapshot(portfolioId);
  }

  // Igual que getEnrichedPositions pero SIN el chequeo de ownership — lo
  // usa PortfolioSnapshotService (job de snapshots diarios), que corre
  // para todos los portafolios del sistema, no en nombre de un usuario
  // puntual que hizo un request. No está expuesto por ningún controller.
  async getEnrichedPositionsForSnapshot(
    portfolioId: string,
  ): Promise<EnrichedPosition[]> {
    const positions = await this.prisma.assetPosition.findMany({
      where: {
        wallet: { portfolioId, isActive: true },
        quantity: { gt: 0 },
      },
      include: { wallet: true },
    });

    if (positions.length === 0) return [];

    const assetIds = [...new Set(positions.map((p) => p.assetId))];
    const [assets, prices] = await Promise.all([
      this.marketService.getAssetsByIds(assetIds),
      this.marketService.getPricesByAssetIds(assetIds),
    ]);

    return positions.map((p) => {
      const asset = assets.get(p.assetId);
      const priceInfo = prices.get(p.assetId);
      const currentPrice = priceInfo?.price ?? p.avgPrice;
      const currentValue = p.quantity * currentPrice;

      return {
        id: p.id,
        portfolioId,
        walletId: p.walletId,
        assetId: p.assetId,
        assetSymbol: asset?.symbol ?? priceInfo?.symbol ?? '???',
        assetName: asset?.name ?? priceInfo?.name ?? 'Desconocido',
        quantity: p.quantity,
        averageCost: p.avgPrice,
        currentPrice,
        currentValue,
        realizedPnl: p.realizedProfit,
        unrealizedPnl: currentValue - p.quantity * p.avgPrice,
        changePercent24h: priceInfo?.changePercent24h ?? 0,
      };
    });
  }

  // Usado por PortfolioSnapshotService para saber sobre qué portafolios
  // correr el snapshot diario — no filtra por usuario a propósito (es un
  // job de sistema, no un endpoint).
  async listAllPortfolioIds(): Promise<string[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      select: { id: true },
    });
    return portfolios.map((p) => p.id);
  }

  async getPositions(
    userId: string,
    portfolioId: string,
  ): Promise<AssetPositionDto[]> {
    const enriched = await this.getEnrichedPositions(userId, portfolioId);
    // No se expone `changePercent24h` en el contrato público de posiciones
    // (solo se usa internamente para ponderar el summary) — se arma el
    // objeto explícito en vez de desestructurar para no dejar variables
    // sin usar.
    return enriched.map((p) => ({
      id: p.id,
      portfolioId: p.portfolioId,
      walletId: p.walletId,
      assetSymbol: p.assetSymbol,
      assetName: p.assetName,
      quantity: p.quantity,
      averageCost: p.averageCost,
      currentPrice: p.currentPrice,
      currentValue: p.currentValue,
      realizedPnl: p.realizedPnl,
      unrealizedPnl: p.unrealizedPnl,
    }));
  }

  async getSummary(
    userId: string,
    portfolioId: string,
  ): Promise<PortfolioSummaryDto> {
    const positions = await this.getEnrichedPositions(userId, portfolioId);

    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalInvested = positions.reduce(
      (sum, p) => sum + p.quantity * p.averageCost,
      0,
    );
    const realizedPnl = positions.reduce((sum, p) => sum + p.realizedPnl, 0);
    const unrealizedPnl = positions.reduce(
      (sum, p) => sum + p.unrealizedPnl,
      0,
    );
    // Variación 24h del portafolio = promedio de la variación de cada
    // activo, ponderado por cuánto pesa ese activo en el valor total.
    const changePercent24h =
      totalValue > 0
        ? positions.reduce(
            (sum, p) =>
              sum + p.changePercent24h * (p.currentValue / totalValue),
            0,
          )
        : 0;

    return {
      portfolioId,
      totalValue,
      totalInvested,
      realizedPnl,
      unrealizedPnl,
      changePercent24h,
      asOf: new Date().toISOString(),
    };
  }

  async getAllocation(
    userId: string,
    portfolioId: string,
  ): Promise<AssetAllocationDto[]> {
    const positions = await this.getEnrichedPositions(userId, portfolioId);
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

    return positions
      .map((p) => ({
        assetSymbol: p.assetSymbol,
        assetName: p.assetName,
        valueInBaseCurrency: p.currentValue,
        percentage: totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.valueInBaseCurrency - a.valueInBaseCurrency);
  }

  // Rendimiento histórico (RFW-04) — expone los PortfolioSnapshot que ya
  // genera PortfolioSnapshotService (job diario, ver
  // portfolio-snapshot.service.ts). `days` acota cuánto atrás mirar
  // (por defecto ~13 meses, de sobra para el selector "ALL" del
  // frontend); si el portafolio es nuevo o el job todavía no corrió,
  // simplemente devuelve un array vacío — el frontend ya sabe mostrar
  // "sin histórico todavía" en ese caso.
  async getPerformance(
    userId: string,
    portfolioId: string,
    days = 400,
  ): Promise<PerformancePointDto[]> {
    await this.findOwnedOrThrow(userId, portfolioId);

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const snapshots = await this.prisma.portfolioSnapshot.findMany({
      where: { portfolioId, snapshotDate: { gte: since } },
      orderBy: { snapshotDate: 'asc' },
    });

    return snapshots.map((s) => ({
      date: s.snapshotDate.toISOString().slice(0, 10),
      totalValue: s.totalValue,
    }));
  }
}
