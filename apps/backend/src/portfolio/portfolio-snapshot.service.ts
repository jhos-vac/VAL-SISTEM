import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { PortfolioService } from './portfolio.service';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

// Job de snapshots diarios de portafolio (pendiente de la Bitácora) —
// desbloquea el gráfico de rendimiento histórico real del dashboard, que
// hoy sigue con datos de ejemplo (ver Estado_Web_VAL-SISTEM.md).
//
// Mismo patrón que BinanceTickerSyncService (setInterval nativo en vez
// de @nestjs/schedule, ver esa clase para el motivo), pero acá el
// intervalo es solo para CHEQUEAR si hay que escribir el punto de hoy —
// PortfolioSnapshot tiene un unique constraint en (portfolioId,
// snapshotDate), así que hacer upsert del día de hoy varias veces en el
// mismo día no crea duplicados, solo mantiene ese punto fresco con el
// valor más reciente; recién al cruzar la medianoche UTC empieza a
// escribirse un punto nuevo. Corre cada hora en vez de cada 5 minutos
// (como el ticker) porque no hace falta más resolución que esa para un
// gráfico diario.
@Injectable()
export class PortfolioSnapshotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PortfolioSnapshotService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly portfolioService: PortfolioService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.snapshotAll();
    }, CHECK_INTERVAL_MS);
    this.timer.unref?.();
    // Corrida inmediata al arrancar, para que el primer punto del
    // gráfico aparezca sin esperar a la próxima hora en punto.
    void this.snapshotAll();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

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

    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
    const investmentValue = positions.reduce(
      (sum, p) => sum + p.quantity * p.averageCost,
      0,
    );
    const profit = totalValue - investmentValue;
    const profitPercent =
      investmentValue > 0 ? (profit / investmentValue) * 100 : 0;
    const snapshotDate = startOfUtcDay(new Date());

    const snapshot = await this.prisma.portfolioSnapshot.upsert({
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

    await this.prisma.$transaction(async (tx) => {
      await tx.portfolioSnapshotItems.deleteMany({
        where: { snapshotId: snapshot.id },
      });
      if (positions.length > 0) {
        await tx.portfolioSnapshotItems.createMany({
          data: positions.map((p) => ({
            snapshotId: snapshot.id,
            assetId: p.assetId,
            quantity: p.quantity,
            value: p.currentValue,
            allocation:
              totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0,
          })),
        });
      }
    });
  }
}
