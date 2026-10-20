import { Injectable } from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { PortfolioService } from './portfolio.service';
import { exchangeWalletAddress } from './exchange-wallets';

// Persistencia de las cuentas de exchange conectadas y su historial de
// sync. Las tablas viven en la base Portfolio, así que el dueño es este
// módulo; Exchange (integración con Binance) las usa solo por acá.

export interface StoredExchangeAccount {
  id: string;
  userId: string;
  accountName: string;
  apiKey: string; // cifrada
  apiSecret: string; // cifrada
  isTestnet: boolean;
}

export interface ExchangeAccountWithLastSync extends StoredExchangeAccount {
  lastSync: { status: string; finishedAt: Date; message: string | null } | null;
}

export interface NewExchangeAccount {
  userId: string;
  exchangeId: string;
  label: string;
  apiKey: string; // ya cifrada
  apiSecret: string; // ya cifrada
  isTestnet: boolean;
}

export interface SyncRecord {
  status: 'completed' | 'failed';
  startedAt: Date;
  recordsProcessed: number;
  message: string;
}

const SELECT_ACCOUNT = {
  id: true,
  userId: true,
  accountName: true,
  apiKey: true,
  apiSecret: true,
  isTestnet: true,
} as const;

@Injectable()
export class ExchangeAccountStore {
  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly portfolioService: PortfolioService,
  ) {}

  // Cuenta y wallet Spot juntas: nunca queda una cuenta sin wallet. La
  // wallet va al portafolio predeterminado del usuario.
  async create(input: NewExchangeAccount): Promise<StoredExchangeAccount> {
    const portfolio = await this.portfolioService.getOrCreateDefault(
      input.userId,
    );
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.exchangeAccount.create({
        data: {
          userId: input.userId,
          exchangeId: input.exchangeId,
          accountName: input.label,
          apiKey: input.apiKey,
          apiSecret: input.apiSecret,
          isTestnet: input.isTestnet,
          syncEnabled: true,
        },
        select: SELECT_ACCOUNT,
      });
      await tx.wallet.create({
        data: {
          portfolioId: portfolio.id,
          exchangeAccountId: account.id,
          walletName: input.label,
          walletType: 'exchange',
          address: exchangeWalletAddress(account.id),
          network: input.isTestnet ? 'Binance Testnet' : 'Binance',
        },
      });
      return account;
    });
  }

  async listForUser(userId: string): Promise<ExchangeAccountWithLastSync[]> {
    const accounts = await this.prisma.exchangeAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: SELECT_ACCOUNT,
    });
    if (accounts.length === 0) return [];

    const syncs = await this.prisma.syncHistory.findMany({
      where: { exchangeAccountId: { in: accounts.map((a) => a.id) } },
      orderBy: { startedAt: 'desc' },
      select: {
        exchangeAccountId: true,
        status: true,
        finishedAt: true,
        message: true,
      },
    });
    const lastByAccount = new Map<string, (typeof syncs)[number]>();
    for (const sync of syncs) {
      if (!lastByAccount.has(sync.exchangeAccountId)) {
        lastByAccount.set(sync.exchangeAccountId, sync);
      }
    }

    return accounts.map((a) => {
      const last = lastByAccount.get(a.id);
      return {
        ...a,
        lastSync: last
          ? {
              status: last.status,
              finishedAt: last.finishedAt,
              message: last.message,
            }
          : null,
      };
    });
  }

  findOwned(
    userId: string,
    accountId: string,
  ): Promise<StoredExchangeAccount | null> {
    return this.prisma.exchangeAccount.findFirst({
      where: { id: accountId, userId },
      select: SELECT_ACCOUNT,
    });
  }

  listSyncEnabled(): Promise<StoredExchangeAccount[]> {
    return this.prisma.exchangeAccount.findMany({
      where: { syncEnabled: true },
      select: SELECT_ACCOUNT,
    });
  }

  async recordSync(accountId: string, record: SyncRecord): Promise<void> {
    await this.prisma.syncHistory.create({
      data: {
        exchangeAccountId: accountId,
        status: record.status,
        startedAt: record.startedAt,
        finishedAt: new Date(),
        recordsProcessed: record.recordsProcessed,
        message: record.message,
      },
    });
  }

  // Borra la cuenta con todo lo que generó (transacciones, posiciones,
  // wallets, historial de sync), en una sola transacción.
  async delete(accountId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const wallets = await tx.wallet.findMany({
        where: { exchangeAccountId: accountId },
        select: { id: true },
      });
      const walletIds = wallets.map((w) => w.id);
      if (walletIds.length > 0) {
        await tx.transaction.deleteMany({
          where: { assetPosition: { walletId: { in: walletIds } } },
        });
        await tx.assetPosition.deleteMany({
          where: { walletId: { in: walletIds } },
        });
        await tx.wallet.deleteMany({ where: { id: { in: walletIds } } });
      }
      await tx.syncHistory.deleteMany({
        where: { exchangeAccountId: accountId },
      });
      await tx.exchangeAccount.delete({ where: { id: accountId } });
    });
  }
}
