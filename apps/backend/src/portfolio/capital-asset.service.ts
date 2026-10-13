import { BadRequestException, Injectable } from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { MarketService } from '../market/market.service';

// Monedas capital del usuario (ver model CapitalAsset): se eligen por
// símbolo y se guardan por assetId, igual que las posiciones.
@Injectable()
export class CapitalAssetService {
  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly marketService: MarketService,
  ) {}

  async list(userId: string): Promise<string[]> {
    const rows = await this.prisma.capitalAsset.findMany({
      where: { userId },
      select: { assetId: true },
    });
    const assets = await this.marketService.getAssetsByIds(
      rows.map((r) => r.assetId),
    );
    return [...assets.values()].map((a) => a.symbol).sort();
  }

  async replace(userId: string, symbols: string[]): Promise<string[]> {
    const wanted = [...new Set(symbols.map((s) => s.trim().toUpperCase()))];
    const catalog = await this.marketService.getAssets();
    const bySymbol = new Map(catalog.map((a) => [a.symbol, a.id]));
    const unknown = wanted.filter((s) => !bySymbol.has(s));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Moneda(s) no encontrada(s) en el catálogo: ${unknown.join(', ')}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.capitalAsset.deleteMany({ where: { userId } }),
      this.prisma.capitalAsset.createMany({
        data: wanted.map((s) => ({ userId, assetId: bySymbol.get(s)! })),
      }),
    ]);
    return wanted.sort();
  }
}
