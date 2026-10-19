import { Injectable, NotFoundException } from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { MarketService } from '../market/market.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import {
  summarizePositions,
  valuePosition,
  type CostSource,
} from './cost-basis';
import { lockForTransaction } from '../common/db/advisory-lock';

// Id especial para pedir la vista "General": suma de todos los portafolios
// del usuario. Es virtual (no existe como fila), así que nunca queda
// desactualizada ni duplica datos.
export const ALL_PORTFOLIOS = 'all';

const DEFAULT_PORTFOLIO_NAME = 'Mi Portafolio';

export interface PortfolioDto {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  baseCurrency: string;
  // Publicación en el ranking (ver PublicPortfoliosService).
  isPublic: boolean;
  publicAlias: string | null;
  copiedFromId: string | null;
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
  // Moneda capital del usuario: no cuenta en invertido ni en ganancias.
  isCapital: boolean;
  // De dónde sale el precio de compra y desde cuándo está fijo (ISO).
  costSource: CostSource;
  costFixedAt: string | null;
  changePercent24h: number;
}

export interface EnrichedPosition extends AssetPositionDto {
  changePercent24h: number;
  assetId: string;
}

export interface PortfolioSummaryDto {
  portfolioId: string;
  totalValue: number;
  // Parte del valor total en monedas capital (ver CapitalAsset).
  capitalValue: number;
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
    isPublic: boolean;
    publicAlias: string | null;
    copiedFromId: string | null;
  }): PortfolioDto {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      isDefault: p.isDefault,
      baseCurrency: p.baseCurrency,
      isPublic: p.isPublic,
      publicAlias: p.publicAlias,
      copiedFromId: p.copiedFromId,
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

  // Traduce el portafolio pedido a la lista de ids sobre los que consultar:
  // un solo portafolio (con chequeo de ownership) o, para 'all', todos los
  // del usuario.
  async resolveScope(userId: string, portfolioId: string): Promise<string[]> {
    if (portfolioId === ALL_PORTFOLIOS) {
      const rows = await this.prisma.portfolio.findMany({
        where: { userId },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    await this.findOwnedOrThrow(userId, portfolioId);
    return [portfolioId];
  }

  async create(userId: string, dto: CreatePortfolioDto): Promise<PortfolioDto> {
    const portfolio = await this.prisma.$transaction(async (tx) => {
      // Serializa los cambios de portafolios de este usuario: dos altas
      // simultáneas no pueden quedar las dos como predeterminadas.
      await lockForTransaction(tx, `portfolios:${userId}`);
      const isFirst = (await tx.portfolio.count({ where: { userId } })) === 0;
      const makeDefault = isFirst || dto.isDefault === true;
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

  // Portafolio donde cae lo que el usuario no ubicó a mano (p.ej. una
  // cuenta de Binance recién conectada): el predeterminado, o el más viejo,
  // o uno nuevo si todavía no tiene ninguno.
  async getOrCreateDefault(userId: string): Promise<PortfolioDto> {
    const portfolio = await this.prisma.$transaction(async (tx) => {
      await lockForTransaction(tx, `portfolios:${userId}`);
      const existing = await tx.portfolio.findFirst({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      return (
        existing ??
        tx.portfolio.create({
          data: {
            userId,
            name: DEFAULT_PORTFOLIO_NAME,
            description: '',
            baseCurrency: 'USD',
            isDefault: true,
          },
        })
      );
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
      await lockForTransaction(tx, `portfolios:${userId}`);
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
    const ids = await this.resolveScope(userId, portfolioId);
    return this.getEnrichedPositionsForPortfolios(ids, userId);
  }

  // Igual que getEnrichedPositions pero SIN el chequeo de ownership — lo
  // usa PortfolioSnapshotService (job de snapshots diarios), que corre
  // para todos los portafolios del sistema, no en nombre de un usuario
  // puntual que hizo un request. No está expuesto por ningún controller.
  async getEnrichedPositionsForSnapshot(
    portfolioId: string,
  ): Promise<EnrichedPosition[]> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: { userId: true },
    });
    if (!portfolio) return [];
    return this.getEnrichedPositionsForPortfolios(
      [portfolioId],
      portfolio.userId,
    );
  }

  private async getEnrichedPositionsForPortfolios(
    portfolioIds: string[],
    userId: string,
  ): Promise<EnrichedPosition[]> {
    if (portfolioIds.length === 0) return [];
    const [positions, capitalAssetIds] = await Promise.all([
      this.prisma.assetPosition.findMany({
        where: {
          wallet: { portfolioId: { in: portfolioIds }, isActive: true },
          quantity: { gt: 0 },
        },
        include: { wallet: true },
      }),
      this.getCapitalAssetIds(userId),
    ]);

    if (positions.length === 0) return [];

    const assetIds = [...new Set(positions.map((p) => p.assetId))];
    const [assets, prices] = await Promise.all([
      this.marketService.getAssetsByIds(assetIds),
      this.marketService.getPricesByAssetIds(assetIds),
    ]);

    return positions.map((p) => {
      const asset = assets.get(p.assetId);
      const priceInfo = prices.get(p.assetId);
      const { currentPrice, currentValue, unrealizedPnl } = valuePosition(
        p.quantity,
        p.avgPrice,
        priceInfo?.price,
      );

      return {
        id: p.id,
        portfolioId: p.wallet.portfolioId,
        walletId: p.walletId,
        assetId: p.assetId,
        assetSymbol: asset?.symbol ?? priceInfo?.symbol ?? '???',
        assetName: asset?.name ?? priceInfo?.name ?? 'Desconocido',
        quantity: p.quantity,
        averageCost: p.avgPrice,
        currentPrice,
        currentValue,
        realizedPnl: p.realizedProfit,
        unrealizedPnl,
        isCapital: capitalAssetIds.has(p.assetId),
        costSource: p.costSource as CostSource,
        costFixedAt: p.costFixedAt?.toISOString() ?? null,
        changePercent24h: priceInfo?.changePercent24h ?? 0,
      };
    });
  }

  // Usado por PortfolioSnapshotService para saber sobre qué portafolios
  // correr el snapshot diario — no filtra por usuario a propósito (es un
  // job de sistema, no un endpoint).
  // Monedas capital del usuario (ver CapitalAsset): no cuentan como
  // inversión.
  async getCapitalAssetIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.capitalAsset.findMany({
      where: { userId },
      select: { assetId: true },
    });
    return new Set(rows.map((r) => r.assetId));
  }

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
    // Las monedas capital no se listan como posiciones: solo aparecen como
    // capital en el resumen (capitalValue).
    const enriched = (
      await this.getEnrichedPositions(userId, portfolioId)
    ).filter((p) => !p.isCapital);
    // Se arma el objeto explícito: el contrato público no lleva assetId.
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
      isCapital: p.isCapital,
      costSource: p.costSource,
      costFixedAt: p.costFixedAt,
      changePercent24h: p.changePercent24h,
    }));
  }

  async getSummary(
    userId: string,
    portfolioId: string,
  ): Promise<PortfolioSummaryDto> {
    const positions = await this.getEnrichedPositions(userId, portfolioId);

    const totals = summarizePositions(positions);

    return {
      portfolioId,
      ...totals,
      asOf: new Date().toISOString(),
    };
  }

  async getAllocation(
    userId: string,
    portfolioId: string,
  ): Promise<AssetAllocationDto[]> {
    const positions = (
      await this.getEnrichedPositions(userId, portfolioId)
    ).filter((p) => !p.isCapital);
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

    // La misma moneda puede estar en varias wallets (Spot, Earn, otro
    // portafolio): en la distribución se agrupa por moneda.
    const bySymbol = new Map<string, { name: string; value: number }>();
    for (const p of positions) {
      const prev = bySymbol.get(p.assetSymbol);
      bySymbol.set(p.assetSymbol, {
        name: p.assetName,
        value: (prev?.value ?? 0) + p.currentValue,
      });
    }

    return [...bySymbol.entries()]
      .map(([assetSymbol, v]) => ({
        assetSymbol,
        assetName: v.name,
        valueInBaseCurrency: v.value,
        percentage: totalValue > 0 ? (v.value / totalValue) * 100 : 0,
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
    const ids = await this.resolveScope(userId, portfolioId);

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const snapshots = await this.prisma.portfolioSnapshot.findMany({
      where: { portfolioId: { in: ids }, snapshotDate: { gte: since } },
      orderBy: { snapshotDate: 'asc' },
    });

    // En la vista General se suman los snapshots de todos los portafolios
    // por fecha (con un solo portafolio queda igual que antes).
    const byDate = new Map<string, number>();
    for (const s of snapshots) {
      const date = s.snapshotDate.toISOString().slice(0, 10);
      byDate.set(date, (byDate.get(date) ?? 0) + s.totalValue);
    }
    return [...byDate.entries()].map(([date, totalValue]) => ({
      date,
      totalValue,
    }));
  }
}
