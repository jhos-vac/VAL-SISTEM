import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
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

const DEFAULT_PORTFOLIO_NAME = 'Mi Portafolio';

@Injectable()
export class ExchangeService {
  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly marketService: MarketService,
    private readonly binanceClient: BinanceAccountClientService,
    private readonly syncService: BinanceAccountSyncService,
  ) {}

  // El concepto de "wallet"/"portafolio" queda oculto en el flujo de
  // conexión, igual que en el alta manual de transacciones (ver
  // getOrCreateDefaultWallet en el frontend) — si el usuario todavía no
  // tiene ningún portafolio, se le crea uno por defecto acá mismo.
  private async resolveDefaultPortfolio(userId: string) {
    const existing = await this.prisma.portfolio.findFirst({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (existing) return existing;

    return this.prisma.portfolio.create({
      data: {
        userId,
        name: DEFAULT_PORTFOLIO_NAME,
        description: '',
        baseCurrency: 'USD',
        isDefault: true,
      },
    });
  }

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

    const portfolio = await this.resolveDefaultPortfolio(userId);

    const account = await this.prisma.exchangeAccount.create({
      data: {
        userId,
        exchangeId: exchange.id,
        accountName: dto.label,
        apiKey: encryptSecret(dto.apiKey),
        apiSecret: encryptSecret(dto.apiSecret),
        isTestnet: dto.isTestnet ?? false,
        syncEnabled: true,
      },
    });

    await this.prisma.wallet.create({
      data: {
        portfolioId: portfolio.id,
        exchangeAccountId: account.id,
        walletName: dto.label,
        walletType: 'exchange',
        address: `binance:${account.id}`,
        network: dto.isTestnet ? 'Binance Testnet' : 'Binance',
      },
    });

    const syncResult = await this.syncService.syncAccount({
      id: account.id,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isTestnet: account.isTestnet,
    });

    // No se bloquea la conexión si la key tiene permisos de más — es
    // decisión del usuario — pero se avisa de inmediato, que es
    // justamente el punto de validar en el momento en vez de descubrirlo
    // después.
    const warning = snapshot.canWithdraw
      ? 'Esta API key tiene habilitado el permiso de retiros. Por seguridad, te recomendamos crear una nueva key en Binance con únicamente "Enable Reading" y reemplazarla.'
      : undefined;

    return {
      id: account.id,
      exchange: 'binance',
      label: account.accountName,
      apiKeyLast4: dto.apiKey.slice(-4),
      status: syncResult.status,
      lastSyncedAt: new Date().toISOString(),
      warning,
      syncMessage: syncResult.message,
    };
  }

  async list(userId: string): Promise<ExchangeAccountDto[]> {
    const accounts = await this.prisma.exchangeAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (accounts.length === 0) return [];

    const lastSyncs = await this.prisma.syncHistory.findMany({
      where: { exchangeAccountId: { in: accounts.map((a) => a.id) } },
      orderBy: { startedAt: 'desc' },
    });
    const lastSyncByAccount = new Map<string, (typeof lastSyncs)[number]>();
    for (const sync of lastSyncs) {
      if (!lastSyncByAccount.has(sync.exchangeAccountId)) {
        lastSyncByAccount.set(sync.exchangeAccountId, sync);
      }
    }

    return accounts.map((account) => {
      const lastSync = lastSyncByAccount.get(account.id);
      // La API key completa nunca se expone — se descifra en memoria
      // solo para mostrar el sufijo (RFC-02) y se descarta enseguida.
      let apiKeyLast4 = '????';
      try {
        apiKeyLast4 = decryptSecret(account.apiKey).slice(-4);
      } catch {
        // EXCHANGE_CREDENTIALS_KEY cambió desde que se guardó esta
        // credencial (p.ej. se rotó la clave de cifrado) — no rompe el
        // listado, solo no se puede mostrar el sufijo real.
      }
      return {
        id: account.id,
        exchange: 'binance',
        label: account.accountName,
        apiKeyLast4,
        status:
          (lastSync?.status as 'completed' | 'failed' | undefined) ?? 'pending',
        lastSyncedAt: lastSync?.finishedAt.toISOString() ?? null,
      };
    });
  }

  private async findOwnedOrThrow(userId: string, accountId: string) {
    const account = await this.prisma.exchangeAccount.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Cuenta de exchange no encontrada');
    }
    return account;
  }

  async triggerSync(userId: string, accountId: string) {
    const account = await this.findOwnedOrThrow(userId, accountId);
    return this.syncService.syncAccount({
      id: account.id,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      isTestnet: account.isTestnet,
    });
  }

  // Hard delete real (no hay isActive en el schema para ExchangeAccount,
  // y tampoco tendría sentido soft-deletear una fila que solo existe
  // para guardar credenciales cifradas) — se borra en cascada
  // transacciones -> posiciones -> wallets -> historial de sync -> la
  // cuenta, todo en una transacción.
  async disconnect(userId: string, accountId: string): Promise<void> {
    const account = await this.findOwnedOrThrow(userId, accountId);

    await this.prisma.$transaction(async (tx) => {
      const wallets = await tx.wallet.findMany({
        where: { exchangeAccountId: account.id },
      });
      const walletIds = wallets.map((w) => w.id);

      if (walletIds.length > 0) {
        const positions = await tx.assetPosition.findMany({
          where: { walletId: { in: walletIds } },
          select: { id: true },
        });
        const positionIds = positions.map((p) => p.id);
        if (positionIds.length > 0) {
          await tx.transaction.deleteMany({
            where: { assetPositionId: { in: positionIds } },
          });
          await tx.assetPosition.deleteMany({
            where: { walletId: { in: walletIds } },
          });
        }
        await tx.wallet.deleteMany({ where: { id: { in: walletIds } } });
      }

      await tx.syncHistory.deleteMany({
        where: { exchangeAccountId: account.id },
      });
      await tx.exchangeAccount.delete({ where: { id: account.id } });
    });
  }
}
