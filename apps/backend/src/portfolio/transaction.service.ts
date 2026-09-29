import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { PortfolioService } from './portfolio.service';
import { MarketService } from '../market/market.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

export interface TransactionDto {
  id: string;
  portfolioId: string;
  assetSymbol: string;
  type: string;
  quantity: number;
  price: number;
  fee: number;
  notes?: string;
  executedAt: string;
  source: 'manual' | 'sync';
}

export interface TransactionFilters {
  assetSymbol?: string;
  type?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly portfolioService: PortfolioService,
    private readonly marketService: MarketService,
  ) {}

  private async resolveOwnedWallet(userId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      include: { portfolio: true },
    });
    if (!wallet || wallet.portfolio.userId !== userId) {
      throw new NotFoundException('Wallet no encontrada');
    }
    return wallet;
  }

  // Alta manual de compra/venta/transferencia (RFW-08). Mantiene
  // AssetPosition al día con costo promedio ponderado (weighted average
  // cost) — el mismo método que ya usan las apps de referencia del
  // proyecto para "trackeo" manual:
  //  - buy/transfer_in: suma cantidad, recalcula el costo promedio.
  //  - sell/transfer_out: resta cantidad (falla si no alcanza), el costo
  //    promedio NO cambia; solo `sell` acumula ganancia realizada
  //    (transfer_out es solo mover activos, no una venta).
  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionDto> {
    const wallet = await this.resolveOwnedWallet(userId, dto.walletId);

    const asset = await this.marketService.getAssetBySymbol(dto.assetSymbol);
    if (!asset) {
      throw new NotFoundException(
        `Activo ${dto.assetSymbol} no encontrado en el catálogo`,
      );
    }

    const transactionType = await this.prisma.transactionType.findUnique({
      where: { code: dto.type },
    });
    if (!transactionType) {
      throw new BadRequestException(
        `Tipo de transacción "${dto.type}" no existe — corré npm run db:seed:portfolio`,
      );
    }

    const fee = dto.fee ?? 0;
    const executedAt = new Date(dto.executedAt);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.assetPosition.findUnique({
        where: {
          walletId_assetId: { walletId: dto.walletId, assetId: asset.id },
        },
      });

      const isIncrease = dto.type === 'buy' || dto.type === 'transfer_in';
      let newQuantity: number;
      let newAvgPrice: number;
      let realizedProfitDelta = 0;

      if (isIncrease) {
        newQuantity = (existing?.quantity ?? 0) + dto.quantity;
        newAvgPrice = existing
          ? (existing.quantity * existing.avgPrice + dto.quantity * dto.price) /
            newQuantity
          : dto.price;
      } else {
        if (!existing || existing.quantity < dto.quantity) {
          throw new BadRequestException(
            'No hay suficiente cantidad en la posición para esta venta/transferencia',
          );
        }
        newQuantity = existing.quantity - dto.quantity;
        newAvgPrice = existing.avgPrice;
        if (dto.type === 'sell') {
          realizedProfitDelta =
            dto.quantity * (dto.price - existing.avgPrice) - fee;
        }
      }

      const position = existing
        ? await tx.assetPosition.update({
            where: { id: existing.id },
            data: {
              quantity: newQuantity,
              avgPrice: newAvgPrice,
              realizedProfit: existing.realizedProfit + realizedProfitDelta,
              updatedAt: new Date(),
            },
          })
        : await tx.assetPosition.create({
            data: {
              walletId: dto.walletId,
              assetId: asset.id,
              quantity: newQuantity,
              avgPrice: newAvgPrice,
              realizedProfit: 0,
              unrealizedProfit: 0,
            },
          });

      const transaction = await tx.transaction.create({
        data: {
          assetPositionId: position.id,
          transactionTypeId: transactionType.id,
          quantity: dto.quantity,
          price: dto.price,
          fee,
          total: dto.quantity * dto.price,
          notes: dto.notes,
          executedAt,
        },
      });

      return transaction;
    });

    return {
      id: result.id,
      portfolioId: wallet.portfolioId,
      assetSymbol: asset.symbol,
      type: dto.type,
      quantity: result.quantity,
      price: result.price,
      fee: result.fee,
      notes: result.notes ?? undefined,
      executedAt: result.executedAt.toISOString(),
      source: 'manual',
    };
  }

  async getHistory(
    userId: string,
    portfolioId: string,
    filters: TransactionFilters,
  ): Promise<TransactionDto[]> {
    await this.portfolioService.findOwnedOrThrow(userId, portfolioId);

    let assetId: string | undefined;
    if (filters.assetSymbol) {
      const asset = await this.marketService.getAssetBySymbol(
        filters.assetSymbol,
      );
      if (!asset) return []; // símbolo inexistente -> sin resultados, no error
      assetId = asset.id;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        assetPosition: {
          wallet: { portfolioId },
          ...(assetId ? { assetId } : {}),
        },
        ...(filters.type ? { transactionType: { code: filters.type } } : {}),
        ...(filters.from || filters.to
          ? {
              executedAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: { assetPosition: true, transactionType: true },
      orderBy: { executedAt: 'desc' },
    });

    if (transactions.length === 0) return [];

    const assetIds = [
      ...new Set(transactions.map((t) => t.assetPosition.assetId)),
    ];
    const assets = await this.marketService.getAssetsByIds(assetIds);

    return transactions.map((t) => ({
      id: t.id,
      portfolioId,
      assetSymbol: assets.get(t.assetPosition.assetId)?.symbol ?? '???',
      type: t.transactionType.code,
      quantity: t.quantity,
      price: t.price,
      fee: t.fee,
      notes: t.notes ?? undefined,
      executedAt: t.executedAt.toISOString(),
      source: 'manual',
    }));
  }
}
