import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { BinanceAccountSyncService } from './binance-account-sync.service';

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 min

// Sincronización automática periódica de cuentas de exchange conectadas
// (pendiente de la Bitácora / Estado_Backend.md) — hasta ahora una
// cuenta solo se sincronizaba al conectarse o al pedirlo a mano
// (POST /exchange-accounts/:id/sync). Mismo patrón que
// BinanceTickerSyncService (setInterval nativo en vez de
// @nestjs/schedule, ver esa clase para el motivo), pero con un intervalo
// más largo: acá cada corrida firma requests contra /api/v3/account +
// /api/v3/myTrades de CADA cuenta conectada, que sí cuenta contra el
// rate limit propio de esa API key — a diferencia del ticker sync, que
// pega contra un endpoint público sin key.
@Injectable()
export class BinanceAccountPeriodicSyncService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BinanceAccountPeriodicSyncService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly syncService: BinanceAccountSyncService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.syncAll();
    }, SYNC_INTERVAL_MS);
    this.timer.unref?.();
    // A propósito NO se dispara una corrida inmediata al arrancar (a
    // diferencia del ticker sync): cada cuenta ya se sincroniza una vez
    // al conectarse (ExchangeService.connect), así que duplicarlo acá
    // solo gastaría rate limit sin necesidad.
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async syncAll(): Promise<{ synced: number; failed: number }> {
    if (this.running) {
      this.logger.warn(
        'Sync periódico de cuentas ya en curso, se omite esta corrida',
      );
      return { synced: 0, failed: 0 };
    }
    this.running = true;

    try {
      const accounts = await this.prisma.exchangeAccount.findMany({
        where: { syncEnabled: true },
      });

      let synced = 0;
      let failed = 0;
      for (const account of accounts) {
        const result = await this.syncService.syncAccount({
          id: account.id,
          apiKey: account.apiKey,
          apiSecret: account.apiSecret,
          isTestnet: account.isTestnet,
        });
        if (result.status === 'completed') synced++;
        else failed++;
      }

      if (accounts.length > 0) {
        this.logger.log(
          `Sync periódico de cuentas Binance: ${synced} ok, ${failed} fallida(s) de ${accounts.length}`,
        );
      }
      return { synced, failed };
    } finally {
      this.running = false;
    }
  }
}
