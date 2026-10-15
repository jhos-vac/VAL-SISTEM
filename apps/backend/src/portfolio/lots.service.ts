import { Injectable } from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { MarketService } from '../market/market.service';
import { PortfolioService } from './portfolio.service';
import {
  buildLots,
  valueLot,
  type LotMovementType,
  type ValuedLot,
} from './lots';

export interface LotDto extends Omit<ValuedLot, 'openedAt'> {
  openedAt: string;
  walletId: string;
  walletName: string;
}

// Parte de la posición que no tiene compra registrada (p.ej. un depósito
// en Binance): se muestra aparte, al costo promedio de la posición.
export interface UntrackedHoldingDto {
  walletId: string;
  walletName: string;
  quantity: number;
  averageCost: number;
  currentValue: number;
}

export interface AssetLotsDto {
  assetSymbol: string;
  assetName: string;
  isCapital: boolean;
  currentPrice: number;
  // Totales de los lotes abiertos (FIFO) más lo no rastreado.
  quantity: number;
  invested: number;
  currentValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  lots: LotDto[];
  untracked: UntrackedHoldingDto[];
}

const EPSILON = 1e-9;

@Injectable()
export class LotsService {
  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly marketService: MarketService,
    private readonly portfolioService: PortfolioService,
  ) {}

  // Lotes por activo del portafolio (o de la vista General), opcionalmente
  // de un solo activo. Incluye los lotes cerrados, para el historial.
  async getLots(
    userId: string,
    portfolioId: string,
    assetSymbol?: string,
  ): Promise<AssetLotsDto[]> {
    const portfolioIds = await this.portfolioService.resolveScope(
      userId,
      portfolioId,
    );
    let assetId: string | undefined;
    if (assetSymbol) {
      const asset = await this.marketService.getAssetBySymbol(assetSymbol);
      if (!asset) return [];
      assetId = asset.id;
    }

    const positions = await this.prisma.assetPosition.findMany({
      where: {
        wallet: { portfolioId: { in: portfolioIds }, isActive: true },
        ...(assetId ? { assetId } : {}),
      },
      include: {
        wallet: { select: { id: true, walletName: true } },
        transactions: { include: { transactionType: true } },
      },
    });
    if (positions.length === 0) return [];

    const assetIds = [...new Set(positions.map((p) => p.assetId))];
    const [assets, prices, capital] = await Promise.all([
      this.marketService.getAssetsByIds(assetIds),
      this.marketService.getPricesByAssetIds(assetIds),
      this.portfolioService.getCapitalAssetIds(userId),
    ]);

    const byAsset = new Map<string, AssetLotsDto>();
    for (const position of positions) {
      // El capital no se muestra como inversión (solo en el resumen).
      if (capital.has(position.assetId)) continue;
      const currentPrice =
        prices.get(position.assetId)?.price ?? position.avgPrice;
      let group = byAsset.get(position.assetId);
      if (!group) {
        group = {
          assetSymbol: assets.get(position.assetId)?.symbol ?? '???',
          assetName: assets.get(position.assetId)?.name ?? 'Desconocido',
          isCapital: capital.has(position.assetId),
          currentPrice,
          quantity: 0,
          invested: 0,
          currentValue: 0,
          unrealizedPnl: 0,
          realizedPnl: 0,
          lots: [],
          untracked: [],
        };
        byAsset.set(position.assetId, group);
      }

      const { lots } = buildLots(
        position.transactions.map((t) => ({
          id: t.id,
          type: t.transactionType.code as LotMovementType,
          quantity: t.quantity,
          price: t.price,
          executedAt: t.executedAt,
        })),
      );
      let tracked = 0;
      for (const lot of lots) {
        const valued = valueLot(lot, currentPrice);
        tracked += valued.remaining;
        group.lots.push({
          ...valued,
          openedAt: valued.openedAt.toISOString(),
          walletId: position.wallet.id,
          walletName: position.wallet.walletName,
        });
        group.quantity += valued.remaining;
        group.invested += valued.invested;
        group.currentValue += valued.currentValue;
        group.unrealizedPnl += valued.unrealizedPnl;
        group.realizedPnl += valued.realizedPnl;
      }

      const untrackedQty = position.quantity - tracked;
      if (untrackedQty > EPSILON) {
        const value = untrackedQty * currentPrice;
        const cost = untrackedQty * position.avgPrice;
        group.untracked.push({
          walletId: position.wallet.id,
          walletName: position.wallet.walletName,
          quantity: untrackedQty,
          averageCost: position.avgPrice,
          currentValue: value,
        });
        group.quantity += untrackedQty;
        group.invested += cost;
        group.currentValue += value;
        group.unrealizedPnl += value - cost;
      }
    }

    for (const group of byAsset.values()) {
      group.lots.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    }
    return [...byAsset.values()].sort(
      (a, b) => b.currentValue - a.currentValue,
    );
  }
}
