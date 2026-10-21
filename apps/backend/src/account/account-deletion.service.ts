import { Injectable, Logger } from '@nestjs/common';
import { AccountClosureService } from '../users/account-closure.service';
import { UserDataPurgeService } from '../portfolio/user-data-purge.service';
import { AlertsService } from '../alerts/alerts.service';

// Días durante los que el job sigue limpiando los datos de una cuenta dada
// de baja (por si un paso falló o llegó una escritura tardía).
export const PURGE_RETRY_DAYS = 30;

// Borrado de cuenta de punta a punta. Cada base se limpia con su propia
// transacción (no hay transacciones entre bases distintas), en este orden:
//  1. Identity: la cuenta queda dada de baja y sin datos personales. Desde
//     acá ya no se puede iniciar sesión ni renovar la sesión.
//  2. Portfolio: se borran portafolios, posiciones, cuentas de exchange, …
//  3. Automation: avisos y notificaciones.
// Si los pasos 2 o 3 fallan, la cuenta igual queda dada de baja y el job
// `account.purge-closed` lo reintenta (es idempotente).
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly closure: AccountClosureService,
    private readonly portfolioData: UserDataPurgeService,
    private readonly alerts: AlertsService,
  ) {}

  private async purgeData(userId: string): Promise<void> {
    await this.portfolioData.purgeUser(userId);
    await this.alerts.purgeUser(userId);
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    await this.closure.close(userId, password);
    try {
      await this.purgeData(userId);
    } catch (err) {
      this.logger.error(
        `Cuenta ${userId} dada de baja; la limpieza de sus datos falló y la reintenta el job`,
        err,
      );
    }
  }

  // Job: vuelve a limpiar los datos de las cuentas dadas de baja hace poco.
  async purgeRecentlyClosed(): Promise<{ purged: number; failed: number }> {
    const counts = { purged: 0, failed: 0 };
    for (const userId of await this.closure.listRecentlyClosed(
      PURGE_RETRY_DAYS,
    )) {
      try {
        await this.purgeData(userId);
        counts.purged++;
      } catch (err) {
        counts.failed++;
        this.logger.error(`Limpieza de la cuenta ${userId} falló`, err);
      }
    }
    return counts;
  }
}
