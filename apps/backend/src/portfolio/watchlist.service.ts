import { BadRequestException, Injectable } from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { MarketService } from '../market/market.service';

export interface WatchlistItemDto {
  assetSymbol: string;
  assetName: string;
  price: number | null;
  changePercent24h: number | null;
  addedAt: string;
}

const DEFAULT_NAME = 'Seguimiento';

// Lista de seguimiento: monedas que el usuario sigue aunque no las tenga.
// Una por usuario (la tabla admite varias; se usa la primera).
@Injectable()
export class WatchlistService {
  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly marketService: MarketService,
  ) {}

  private async getOrCreate(userId: string) {
    const existing = await this.prisma.watchlist.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.watchlist.create({
      data: { userId, name: DEFAULT_NAME },
    });
  }

  async list(userId: string): Promise<WatchlistItemDto[]> {
    const watchlist = await this.prisma.watchlist.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { assets: { orderBy: { createdAt: 'asc' } } },
    });
    if (!watchlist || watchlist.assets.length === 0) return [];
    const ids = watchlist.assets.map((a) => a.assetId);
    const [assets, prices] = await Promise.all([
      this.marketService.getAssetsByIds(ids),
      this.marketService.getPricesByAssetIds(ids),
    ]);
    return watchlist.assets.map((a) => ({
      assetSymbol: assets.get(a.assetId)?.symbol ?? '???',
      assetName: assets.get(a.assetId)?.name ?? '',
      price: prices.get(a.assetId)?.price ?? null,
      changePercent24h: prices.get(a.assetId)?.changePercent24h ?? null,
      addedAt: a.createdAt.toISOString(),
    }));
  }

  async add(userId: string, assetSymbol: string): Promise<WatchlistItemDto[]> {
    const asset = await this.marketService.getAssetBySymbol(assetSymbol);
    if (!asset) {
      throw new BadRequestException(
        `Activo ${assetSymbol} no encontrado en el catálogo`,
      );
    }
    const watchlist = await this.getOrCreate(userId);
    await this.prisma.watchListAsset.upsert({
      where: {
        watchlistId_assetId: { watchlistId: watchlist.id, assetId: asset.id },
      },
      create: { watchlistId: watchlist.id, assetId: asset.id },
      update: {},
    });
    return this.list(userId);
  }

  async remove(
    userId: string,
    assetSymbol: string,
  ): Promise<WatchlistItemDto[]> {
    const asset = await this.marketService.getAssetBySymbol(assetSymbol);
    if (asset) {
      await this.prisma.watchListAsset.deleteMany({
        where: { assetId: asset.id, watchlist: { userId } },
      });
    }
    return this.list(userId);
  }
}
