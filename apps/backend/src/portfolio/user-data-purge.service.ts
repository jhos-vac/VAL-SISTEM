import { Injectable } from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { lockForTransaction } from '../common/db/advisory-lock';

// Borra todo lo de un usuario en la base Portfolio, en una transacción:
// portafolios con sus wallets, posiciones, transacciones, transferencias,
// snapshots, metas y resúmenes; cuentas de exchange con su historial;
// watchlists y monedas capital. Idempotente: correrlo de nuevo sobre un
// usuario ya limpio no hace nada.
@Injectable()
export class UserDataPurgeService {
  constructor(private readonly prisma: PortfolioPrismaService) {}

  async purgeUser(userId: string): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        // Mismo lock que las altas de portafolio: nada se crea en paralelo.
        await lockForTransaction(tx, `portfolios:${userId}`);

        const portfolios = await tx.portfolio.findMany({
          where: { userId },
          select: { id: true },
        });
        const portfolioIds = portfolios.map((p) => p.id);
        const accounts = await tx.exchangeAccount.findMany({
          where: { userId },
          select: { id: true },
        });
        const accountIds = accounts.map((a) => a.id);
        const walletWhere = {
          OR: [
            { portfolioId: { in: portfolioIds } },
            { exchangeAccountId: { in: accountIds } },
          ],
        };

        // De las hojas a la raíz, siguiendo las claves foráneas.
        await tx.transaction.deleteMany({
          where: { assetPosition: { wallet: walletWhere } },
        });
        await tx.assetPosition.deleteMany({ where: { wallet: walletWhere } });
        await tx.transfer.deleteMany({
          where: {
            OR: [{ fromWallet: walletWhere }, { toWallet: walletWhere }],
          },
        });
        await tx.wallet.deleteMany({ where: walletWhere });

        await tx.portfolioSnapshotItems.deleteMany({
          where: { portfolioSnapshot: { portfolioId: { in: portfolioIds } } },
        });
        await tx.portfolioSnapshot.deleteMany({
          where: { portfolioId: { in: portfolioIds } },
        });
        await tx.investmentGoal.deleteMany({
          where: { portfolioId: { in: portfolioIds } },
        });
        await tx.portfolioAssetSummary.deleteMany({
          where: { portfolioId: { in: portfolioIds } },
        });
        await tx.portfolio.deleteMany({ where: { id: { in: portfolioIds } } });

        await tx.syncHistory.deleteMany({
          where: { exchangeAccountId: { in: accountIds } },
        });
        await tx.exchangeAccount.deleteMany({
          where: { id: { in: accountIds } },
        });

        await tx.watchListAsset.deleteMany({
          where: { watchlist: { userId } },
        });
        await tx.watchlist.deleteMany({ where: { userId } });
        await tx.capitalAsset.deleteMany({ where: { userId } });
      },
      { timeout: 30_000 },
    );
  }
}
