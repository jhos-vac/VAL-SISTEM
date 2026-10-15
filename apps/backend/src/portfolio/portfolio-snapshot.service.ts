import { Injectable, Logger } from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { summarizePositions } from './cost-basis';
import { snapshotItemsByAsset } from './snapshot-items';
import { PortfolioService } from './portfolio.service';

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

// Job de snapshots diarios de portafolio (pendiente de la Bitácora) —
// desbloquea el gráfico de rendimiento histórico real del dashboard, que
// hoy sigue con datos de ejemplo (ver Estado_Web_VAL-SISTEM.md).
//
// Lo programa el módulo jobs/ cada hora (y una vez al arrancar), solo para
// CHEQUEAR si hay que escribir el punto de hoy —
// PortfolioSnapshot tiene un unique constraint en (portfolioId,
// snapshotDate), así que hacer upsert del día de hoy varias veces en el
// mismo día no crea duplicados, solo mantiene ese punto fresco con el
// valor más reciente; recién al cruzar la medianoche UTC empieza a
// escribirse un punto nuevo. Corre cada hora en vez de cada 5 minutos
// (como el ticker) porque no hace falta más resolución que esa para un
// gráfico diario.
@Injectable()
export class PortfolioSnapshotService {
  private readonly logger = new Logger(PortfolioSnapshotService.name);
  private running = false;

  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly portfolioService: PortfolioService,
  ) {}

  async snapshotAll(): Promise<{ snapshotted: number; failed: number }> {
    if (this.running) {
      this.logger.warn(
        'Snapshot de portafolios ya en curso, se omite esta corrida',
      );
      return { snapshotted: 0, failed: 0 };
    }
    this.running = true;

    try {
      const portfolioIds = await this.portfolioService.listAllPortfolioIds();
      let snapshotted = 0;
      let failed = 0;

      for (const portfolioId of portfolioIds) {
        try {
          await this.snapshotOne(portfolioId);
          snapshotted++;
        } catch (err) {
          failed++;
          this.logger.error(
            `Fallo al generar el snapshot del portafolio ${portfolioId}`,
            err,
          );
        }
      }

      if (portfolioIds.length > 0) {
        this.logger.log(
          `Snapshots de portafolio: ${snapshotted} ok, ${failed} fallido(s) de ${portfolioIds.length}`,
        );
      }
      return { snapshotted, failed };
    } finally {
      this.running = false;
    }
  }

  private async snapshotOne(portfolioId: string): Promise<void> {
    const positions =
      await this.portfolioService.getEnrichedPositionsForSnapshot(portfolioId);

    // El valor total incluye las monedas capital; la inversión y la
    // ganancia, no (ver summarizePositions).
    const totals = summarizePositions(positions);
    const totalValue = totals.totalValue;
    const investmentValue = totals.totalInvested;
    const profit = totals.unrealizedPnl;
    const profitPercent =
      investmentValue > 0 ? (profit / investmentValue) * 100 : 0;
    const snapshotDate = startOfUtcDay(new Date());

    // Total del día e ítems juntos: nunca queda el total nuevo con ítems
    // de la corrida anterior.
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.portfolioSnapshot.upsert({
        where: { portfolioId_snapshotDate: { portfolioId, snapshotDate } },
        create: {
          portfolioId,
          totalValue,
          investmentValue,
          profit,
          profitPercent,
          snapshotDate,
        },
        update: { totalValue, investmentValue, profit, profitPercent },
      });
      await tx.portfolioSnapshotItems.deleteMany({
        where: { snapshotId: snapshot.id },
      });
      const items = snapshotItemsByAsset(
        positions.filter((p) => !p.isCapital),
        totalValue,
      );
      if (items.length > 0) {
        await tx.portfolioSnapshotItems.createMany({
          data: items.map((item) => ({ snapshotId: snapshot.id, ...item })),
        });
      }
    });
  }
}
