import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import type { Prisma } from '../../prisma/generated/portfolio-cli/client';
import { tryLockForTransaction } from '../common/db/advisory-lock';
import { exchangeWalletAddress } from './exchange-wallets';

// Escritura de posiciones que vienen de un exchange. Para un exchange, el
// balance remoto ES la fuente de verdad: cada sync reemplaza las posiciones
// y transacciones de las wallets de la cuenta por la foto nueva. Exchange
// decide QUÉ hay (balances, costo base, qué wallet lleva el historial);
// este servicio decide CÓMO se guarda, en una sola transacción.

export interface ExchangeTrade {
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
  total: number;
  notes: string;
  executedAt: Date;
}

export interface ExchangeHolding {
  assetId: string;
  quantity: number;
  avgPrice: number;
  realizedProfit: number;
  // De dónde sale avgPrice y desde cuándo está fijo (ver
  // exchange/acquisition-cost.ts).
  costSource: string;
  costFixedAt: Date;
  // Solo en la wallet que "lleva" el historial de esa moneda (para no
  // contar dos veces la misma compra).
  trades: ExchangeTrade[];
}

export interface ExchangeAccountSnapshot {
  spot: ExchangeHolding[];
  earn: ExchangeHolding[];
  funding: ExchangeHolding[];
}

export type ReplaceResult = 'applied' | 'busy';

// Sub-wallets de una cuenta, además de Spot. Se crean solo cuando tienen
// saldo; si ya existían y ahora están vacías, quedan sin posiciones.
const SUB_WALLETS = [
  { key: 'earn', suffix: ':earn', label: 'Earn' },
  { key: 'funding', suffix: ':funding', label: 'Fondos' },
] as const;

const SPOT_SUFFIX = ' · Spot';

// Con la base lejos del backend cada consulta cuesta ~100 ms; la escritura
// va en lote (unas 10 consultas sin importar cuántas monedas haya), pero
// se deja margen sobre los 5 s por defecto de Prisma.
const REPLACE_TIMEOUT_MS = 30_000;

@Injectable()
export class PositionLedgerService {
  constructor(private readonly prisma: PortfolioPrismaService) {}

  async replaceExchangeSnapshot(
    accountId: string,
    snapshot: ExchangeAccountSnapshot,
  ): Promise<ReplaceResult> {
    return this.prisma.$transaction(
      async (tx) => {
        // Un solo sync a la vez por cuenta (manual + periódico, o dos
        // instancias del backend). El que llega segundo no espera: avisa.
        if (!(await tryLockForTransaction(tx, `exchange-sync:${accountId}`))) {
          return 'busy';
        }

        const baseAddress = exchangeWalletAddress(accountId);
        const wallets = await tx.wallet.findMany({
          where: { exchangeAccountId: accountId },
        });
        const spot = wallets.find((w) => w.address === baseAddress);
        if (!spot) {
          throw new Error(
            'No existe una wallet asociada a esta cuenta de exchange.',
          );
        }

        const targets: Array<{
          walletId: string;
          holdings: ExchangeHolding[];
        }> = [{ walletId: spot.id, holdings: snapshot.spot }];
        const baseName = spot.walletName.replace(/ · Spot$/, '');
        for (const def of SUB_WALLETS) {
          const holdings = snapshot[def.key];
          let wallet = wallets.find(
            (w) => w.address === `${baseAddress}${def.suffix}`,
          );
          if (!wallet && holdings.length > 0) {
            wallet = await tx.wallet.create({
              data: {
                portfolioId: spot.portfolioId,
                exchangeAccountId: accountId,
                walletName: `${baseName} · ${def.label}`,
                walletType: 'exchange',
                address: `${baseAddress}${def.suffix}`,
                network: spot.network,
              },
            });
          }
          if (wallet) targets.push({ walletId: wallet.id, holdings });
        }
        // Con más de una wallet, la principal se llama "… · Spot".
        if (targets.length > 1 && !spot.walletName.endsWith(SPOT_SUFFIX)) {
          await tx.wallet.update({
            where: { id: spot.id },
            data: { walletName: `${baseName}${SPOT_SUFFIX}` },
          });
        }

        const types = await tx.transactionType.findMany({
          where: { code: { in: ['buy', 'sell'] } },
        });
        const typeId = new Map(types.map((t) => [t.code, t.id]));

        const walletIds = targets.map((t) => t.walletId);
        await tx.transaction.deleteMany({
          where: { assetPosition: { walletId: { in: walletIds } } },
        });
        await tx.assetPosition.deleteMany({
          where: { walletId: { in: walletIds } },
        });

        // Ids generados acá para poder insertar posiciones y transacciones
        // en dos createMany, en vez de una consulta por moneda.
        const positionRows: Prisma.AssetPositionCreateManyInput[] = [];
        const transactionRows: Prisma.TransactionCreateManyInput[] = [];
        for (const { walletId, holdings } of targets) {
          for (const h of holdings) {
            const id = randomUUID();
            positionRows.push({
              id,
              walletId,
              assetId: h.assetId,
              quantity: h.quantity,
              avgPrice: h.avgPrice,
              realizedProfit: h.realizedProfit,
              unrealizedProfit: 0,
              costSource: h.costSource,
              costFixedAt: h.costFixedAt,
            });
            for (const t of h.trades) {
              const transactionTypeId = typeId.get(t.side);
              if (!transactionTypeId) continue;
              transactionRows.push({
                assetPositionId: id,
                transactionTypeId,
                quantity: t.quantity,
                price: t.price,
                fee: t.fee,
                total: t.total,
                notes: t.notes,
                executedAt: t.executedAt,
              });
            }
          }
        }
        if (positionRows.length > 0) {
          await tx.assetPosition.createMany({ data: positionRows });
        }
        if (transactionRows.length > 0) {
          await tx.transaction.createMany({ data: transactionRows });
        }
        return 'applied';
      },
      { timeout: REPLACE_TIMEOUT_MS },
    );
  }

  // Precio de compra guardado por moneda en las wallets de la cuenta (es el
  // mismo en todas sus wallets), con la cantidad total. El sync lo usa para
  // conservar precios ya fijados en vez de recalcularlos.
  async currentCosts(accountId: string): Promise<Map<string, StoredCost>> {
    const rows = await this.prisma.assetPosition.findMany({
      where: { wallet: { exchangeAccountId: accountId } },
      select: {
        assetId: true,
        quantity: true,
        avgPrice: true,
        costSource: true,
        costFixedAt: true,
      },
    });
    const costs = new Map<string, StoredCost>();
    for (const r of rows) {
      const prev = costs.get(r.assetId);
      costs.set(r.assetId, {
        quantity: (prev?.quantity ?? 0) + r.quantity,
        avgPrice: r.avgPrice,
        costSource: r.costSource,
        costFixedAt: prev?.costFixedAt ?? r.costFixedAt,
      });
    }
    return costs;
  }
}

export interface StoredCost {
  quantity: number;
  avgPrice: number;
  costSource: string;
  costFixedAt: Date | null;
}
