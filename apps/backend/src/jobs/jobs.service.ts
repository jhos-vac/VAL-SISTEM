import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { BinanceTickerSyncService } from '../market/binance-ticker-sync.service';
import { BinanceAccountSyncService } from '../exchange/binance-account-sync.service';
import { PortfolioSnapshotService } from '../portfolio/portfolio-snapshot.service';
import { JobLeaseService } from './job-lease.service';
import { AccountDeletionService } from '../account/account-deletion.service';

interface JobDefinition {
  name: string;
  everyMs: number;
  runOnStart: boolean;
  run: () => Promise<unknown>;
}

const MINUTE = 60_000;

// Programación de los jobs periódicos. Cada dominio expone el trabajo como
// un método público (syncAll, syncAllEnabled, snapshotAll); acá solo se
// decide cuándo corre y que corra una sola instancia a la vez.
//
// setInterval nativo y no @nestjs/schedule: ese paquete trabó `npm install`
// en el pasado (ver comentario en binance-ticker-sync.service.ts).
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly jobs: JobDefinition[];

  constructor(
    private readonly leases: JobLeaseService,
    tickerSync: BinanceTickerSyncService,
    accountSync: BinanceAccountSyncService,
    snapshots: PortfolioSnapshotService,
    accountDeletion: AccountDeletionService,
  ) {
    this.jobs = [
      {
        name: 'market.ticker-sync',
        everyMs: 5 * MINUTE,
        runOnStart: true,
        run: () => tickerSync.syncAll(),
      },
      {
        name: 'exchange.account-sync',
        everyMs: 15 * MINUTE,
        runOnStart: false,
        run: () => accountSync.syncAllEnabled(),
      },
      {
        name: 'portfolio.snapshots',
        everyMs: 60 * MINUTE,
        runOnStart: true,
        run: () => snapshots.snapshotAll(),
      },
      {
        name: 'account.purge-closed',
        everyMs: 60 * MINUTE,
        runOnStart: false,
        run: () => accountDeletion.purgeRecentlyClosed(),
      },
    ];
  }

  onApplicationBootstrap() {
    // En tests (NODE_ENV=test) no se programa nada.
    if (process.env.NODE_ENV === 'test') return;
    for (const job of this.jobs) {
      const timer = setInterval(() => void this.runOnce(job), job.everyMs);
      timer.unref?.();
      this.timers.push(timer);
      if (job.runOnStart) void this.runOnce(job);
    }
  }

  onModuleDestroy() {
    for (const timer of this.timers) clearInterval(timer);
  }

  // Corre el job si esta instancia consigue el lease. El lease queda tomado
  // casi un intervalo completo (90 %): entre todas las instancias el job
  // corre como mucho una vez por intervalo. Si la corrida falla se libera,
  // así el próximo tick (de cualquier instancia) reintenta.
  async runOnce(job: JobDefinition): Promise<'ran' | 'skipped' | 'failed'> {
    let acquired = false;
    try {
      acquired = await this.leases.tryAcquire(job.name, job.everyMs * 0.9);
      if (!acquired) return 'skipped';
      const result = await job.run();
      this.logger.log(`${job.name}: ${JSON.stringify(result)}`);
      return 'ran';
    } catch (err) {
      this.logger.error(`${job.name} falló`, err);
      if (acquired) {
        await this.leases.release(job.name).catch(() => undefined);
      }
      return 'failed';
    }
  }
}
