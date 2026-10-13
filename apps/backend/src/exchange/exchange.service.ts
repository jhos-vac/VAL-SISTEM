import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarketService } from '../market/market.service';
import {
  BinanceAccountClientService,
  type BinanceAccountSnapshot,
} from './binance-account-client.service';
import { BinanceAccountSyncService } from './binance-account-sync.service';
import { ConnectExchangeAccountDto } from './dto/connect-exchange-account.dto';
import {
  encryptSecret,
  decryptSecret,
} from '../common/security/encryption.util';
import { ExchangeAccountStore } from '../portfolio/exchange-account.store';

export interface ExchangeAccountDto {
  id: string;
  exchange: 'binance';
  label: string;
  apiKeyLast4: string;
  status: 'pending' | 'completed' | 'failed';
  lastSyncedAt: string | null;
}

export interface ConnectExchangeAccountResult extends ExchangeAccountDto {
  warning?: string;
  syncMessage: string;
}

// Casos de uso de las cuentas de exchange: validar la key contra Binance,
// conectar, listar, sincronizar y desconectar. No toca la base: la
// persistencia es de Portfolio (ExchangeAccountStore).
@Injectable()
export class ExchangeService {
  constructor(
    private readonly marketService: MarketService,
    private readonly binanceClient: BinanceAccountClientService,
    private readonly syncService: BinanceAccountSyncService,
    private readonly accounts: ExchangeAccountStore,
  ) {}

  async connect(
    userId: string,
    dto: ConnectExchangeAccountDto,
  ): Promise<ConnectExchangeAccountResult> {
    let snapshot: BinanceAccountSnapshot;
    try {
      snapshot = await this.binanceClient.getAccountSnapshot(
        dto.apiKey,
        dto.apiSecret,
        dto.isTestnet ?? false,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo validar la API key.';
      throw new BadRequestException(`Binance rechazó la API key: ${message}`);
    }

    const exchange = await this.marketService.getExchangeBySlug('binance');
    if (!exchange) {
      throw new BadRequestException(
        'No existe el exchange "binance" en el catálogo — corré npm run db:seed:market primero.',
      );
    }

    const account = await this.accounts.create({
      userId,
      exchangeId: exchange.id,
      label: dto.label,
      apiKey: encryptSecret(dto.apiKey),
      apiSecret: encryptSecret(dto.apiSecret),
      isTestnet: dto.isTestnet ?? false,
    });

    const syncResult = await this.syncService.syncAccount(account);

    // No se bloquea la conexión si la key tiene permisos de más — es
    // decisión del usuario — pero se avisa de inmediato.
    const warning = snapshot.canWithdraw
      ? 'Esta API key tiene habilitado el permiso de retiros. Por seguridad, te recomendamos crear una nueva key en Binance con únicamente "Enable Reading" y reemplazarla.'
      : undefined;

    return {
      id: account.id,
      exchange: 'binance',
      label: account.accountName,
      apiKeyLast4: dto.apiKey.slice(-4),
      status: syncResult.status === 'skipped' ? 'pending' : syncResult.status,
      lastSyncedAt: new Date().toISOString(),
      warning,
      syncMessage: syncResult.message,
    };
  }

  async list(userId: string): Promise<ExchangeAccountDto[]> {
    const accounts = await this.accounts.listForUser(userId);
    return accounts.map((account) => {
      // La API key completa nunca se expone — se descifra en memoria solo
      // para mostrar el sufijo (RFC-02) y se descarta enseguida.
      let apiKeyLast4 = '????';
      try {
        apiKeyLast4 = decryptSecret(account.apiKey).slice(-4);
      } catch {
        // EXCHANGE_CREDENTIALS_KEY cambió desde que se guardó (se rotó la
        // clave de cifrado): no rompe el listado, solo no muestra el sufijo.
      }
      return {
        id: account.id,
        exchange: 'binance',
        label: account.accountName,
        apiKeyLast4,
        status:
          (account.lastSync?.status as 'completed' | 'failed' | undefined) ??
          'pending',
        lastSyncedAt: account.lastSync?.finishedAt.toISOString() ?? null,
      };
    });
  }

  private async findOwnedOrThrow(userId: string, accountId: string) {
    const account = await this.accounts.findOwned(userId, accountId);
    if (!account) {
      throw new NotFoundException('Cuenta de exchange no encontrada');
    }
    return account;
  }

  async triggerSync(userId: string, accountId: string) {
    const account = await this.findOwnedOrThrow(userId, accountId);
    return this.syncService.syncAccount(account);
  }

  // Hard delete: la cuenta solo existe para guardar credenciales cifradas,
  // no tiene sentido soft-deletearla.
  async disconnect(userId: string, accountId: string): Promise<void> {
    const account = await this.findOwnedOrThrow(userId, accountId);
    await this.accounts.delete(account.id);
  }
}
