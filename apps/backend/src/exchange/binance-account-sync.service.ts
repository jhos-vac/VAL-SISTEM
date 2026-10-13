import { Injectable, Logger } from '@nestjs/common';
import { MarketService, type AssetSummaryDto } from '../market/market.service';
import { BinanceTickerSyncService } from '../market/binance-ticker-sync.service';
import {
  BinanceAccountClientService,
  type BinanceTrade,
} from './binance-account-client.service';
import { decryptSecret } from '../common/security/encryption.util';
import { computeCostBasisFromTrades } from '../portfolio/cost-basis';
import {
  ExchangeAccountStore,
  type StoredExchangeAccount,
} from '../portfolio/exchange-account.store';
import {
  PositionLedgerService,
  type ExchangeHolding,
} from '../portfolio/position-ledger.service';

export interface SyncResult {
  // 'skipped': ya había un sync en curso para esa cuenta.
  status: 'completed' | 'failed' | 'skipped';
  recordsProcessed: number;
  message: string;
}

type ExchangeAccountForSync = Pick<
  StoredExchangeAccount,
  'id' | 'apiKey' | 'apiSecret' | 'isTestnet'
>;

interface Matched {
  quantity: number;
  asset: AssetSummaryDto;
}

// Sincroniza los balances reales de una cuenta de Binance. Este servicio
// decide QUÉ hay: lee Binance, registra monedas nuevas en el catálogo y
// calcula el costo base desde los trades. CÓMO se guarda (reemplazar las
// posiciones de las wallets de la cuenta, en una transacción y con un sync
// por cuenta a la vez) es responsabilidad de Portfolio: ver
// PositionLedgerService.
//
// El balance de Binance es la fuente de verdad para la CANTIDAD. El costo
// base y la ganancia realizada salen del historial de trades cuando existe
// (ver computeCostBasisFromTrades); si un activo no tiene trades (se
// depositó directo, o es USDT), se usa el precio de mercado actual.
@Injectable()
export class BinanceAccountSyncService {
  private readonly logger = new Logger(BinanceAccountSyncService.name);
  private runningAll = false;

  constructor(
    private readonly marketService: MarketService,
    private readonly tickerSync: BinanceTickerSyncService,
    private readonly binanceClient: BinanceAccountClientService,
    private readonly accounts: ExchangeAccountStore,
    private readonly ledger: PositionLedgerService,
  ) {}

  // Sync de todas las cuentas con sync habilitado (lo dispara el job
  // periódico, ver jobs/).
  async syncAllEnabled(): Promise<{
    synced: number;
    failed: number;
    skipped: number;
  }> {
    if (this.runningAll) return { synced: 0, failed: 0, skipped: 0 };
    this.runningAll = true;
    try {
      const counts = { synced: 0, failed: 0, skipped: 0 };
      for (const account of await this.accounts.listSyncEnabled()) {
        const result = await this.syncAccount(account);
        if (result.status === 'completed') counts.synced++;
        else if (result.status === 'skipped') counts.skipped++;
        else counts.failed++;
      }
      return counts;
    } finally {
      this.runningAll = false;
    }
  }

  async syncAccount(account: ExchangeAccountForSync): Promise<SyncResult> {
    const startedAt = new Date();

    try {
      const apiKey = decryptSecret(account.apiKey);
      const apiSecret = decryptSecret(account.apiSecret);

      // Binance reparte el dinero en varios lugares y cada uno se guarda en
      // su propia wallet, igual que en la app de Binance:
      //  - Spot: /api/v3/account.
      //  - Earn: Simple Earn flexible + plazo fijo. Si no se puede leer, se
      //    cae a las monedas "LD" de Spot (LDBNB es BNB), que solo cubren
      //    el flexible.
      //  - Fondos (Funding): billetera de P2P/pagos, que NO aparece en Spot.
      const [snapshot, earnFromApi, fundingFromApi] = await Promise.all([
        this.binanceClient.getAccountSnapshot(
          apiKey,
          apiSecret,
          account.isTestnet,
        ),
        this.binanceClient.getEarnBalances(
          apiKey,
          apiSecret,
          account.isTestnet,
        ),
        this.binanceClient.getFundingBalances(
          apiKey,
          apiSecret,
          account.isTestnet,
        ),
      ]);

      const aliases = await this.marketService.resolveEarnAliases(
        snapshot.balances.map((b) => b.asset),
      );
      const spotBalances = new Map<string, number>();
      const earnBalances = new Map<string, number>();
      const fundingBalances = new Map<string, number>();
      const addTo = (m: Map<string, number>, symbol: string, qty: number) =>
        m.set(symbol, (m.get(symbol) ?? 0) + qty);

      for (const b of snapshot.balances) {
        const alias = aliases.get(b.asset);
        if (!alias) {
          addTo(spotBalances, b.asset, b.total);
        } else if (!earnFromApi) {
          addTo(earnBalances, alias, b.total);
        }
        // Con los datos reales de Earn disponibles, las monedas LD se
        // ignoran: ya están contadas ahí (si no, se duplicarían).
      }
      for (const b of earnFromApi ?? []) addTo(earnBalances, b.asset, b.total);
      for (const b of fundingFromApi ?? []) {
        addTo(fundingBalances, b.asset, b.total);
      }
      await this.marketService.deactivateAssets([...aliases.keys()]);

      // Toda moneda con balance que no esté en el catálogo se registra sola
      // (con su par contra USDT si Binance lo tiene). Si se creó alguna, se
      // traen sus precios ya mismo para que la posición no quede en 0.
      const newlyRegistered = await this.marketService.ensureAssets([
        ...spotBalances.keys(),
        ...earnBalances.keys(),
        ...fundingBalances.keys(),
      ]);
      if (newlyRegistered.length > 0) {
        await this.tickerSync.syncAll();
      }

      const catalog = await this.marketService.getAssets();
      const bySymbol = new Map(catalog.map((a) => [a.symbol, a]));

      let skipped = 0;
      const toMatched = (balances: Map<string, number>) => {
        const out: Matched[] = [];
        for (const [symbol, quantity] of balances) {
          const asset = bySymbol.get(symbol);
          if (asset) out.push({ quantity, asset });
          else skipped++;
        }
        return out;
      };
      const spotMatched = toMatched(spotBalances);
      const earnMatched = toMatched(earnBalances);
      const fundingMatched = toMatched(fundingBalances);

      const allAssets = new Map(
        [...spotMatched, ...earnMatched, ...fundingMatched].map((m) => [
          m.asset.id,
          m.asset,
        ]),
      );
      const prices = await this.marketService.getPricesByAssetIds([
        ...allAssets.keys(),
      ]);

      // Historial de trades por activo para el costo base. USDT es la
      // moneda de cotización de todos los pares (no hay "USDTUSDT"): su
      // costo es 1:1. Sin precio = sin par contra USDT, tampoco hay
      // historial que pedir.
      const tradesByAssetId = new Map<string, BinanceTrade[]>();
      for (const asset of allAssets.values()) {
        if (asset.symbol === 'USDT') continue;
        if (!prices.has(asset.id)) continue;
        const trades = await this.binanceClient.getMyTrades(
          apiKey,
          apiSecret,
          `${asset.symbol}USDT`,
          account.isTestnet,
        );
        if (trades.length > 0) tradesByAssetId.set(asset.id, trades);
      }

      // El costo base es el mismo para la moneda en cualquier wallet, pero
      // la ganancia realizada y el historial se cuentan una sola vez: en
      // Spot si la moneda está ahí, si no en Earn, si no en Fondos.
      const spotSymbols = new Set(spotBalances.keys());
      const earnSymbols = new Set(earnBalances.keys());
      const toHoldings = (
        matched: Matched[],
        carriesHistory: (symbol: string) => boolean,
      ): ExchangeHolding[] =>
        matched.map(({ quantity, asset }) => {
          const trades = tradesByAssetId.get(asset.id);
          const computed =
            asset.symbol === 'USDT'
              ? { avgPrice: 1, realizedProfit: 0 }
              : trades
                ? computeCostBasisFromTrades(trades)
                : {
                    avgPrice: prices.get(asset.id)?.price ?? 0,
                    realizedProfit: 0,
                  };
          const withHistory = carriesHistory(asset.symbol);
          return {
            assetId: asset.id,
            quantity,
            avgPrice: computed.avgPrice,
            realizedProfit: withHistory ? computed.realizedProfit : 0,
            // El orderId de Binance es numérico y exchangeOrderId es
            // @db.Uuid: queda como referencia en notes.
            trades:
              withHistory && trades
                ? trades.map((t) => ({
                    side: t.isBuyer ? ('buy' as const) : ('sell' as const),
                    quantity: t.qty,
                    price: t.price,
                    fee: t.commission,
                    total: t.quoteQty,
                    notes: `Binance order ${t.orderId} (comisión en ${t.commissionAsset})`,
                    executedAt: new Date(t.time),
                  }))
                : [],
          };
        });

      const outcome = await this.ledger.replaceExchangeSnapshot(account.id, {
        spot: toHoldings(spotMatched, () => true),
        earn: toHoldings(earnMatched, (s) => !spotSymbols.has(s)),
        funding: toHoldings(
          fundingMatched,
          (s) => !spotSymbols.has(s) && !earnSymbols.has(s),
        ),
      });
      if (outcome === 'busy') {
        return {
          status: 'skipped',
          recordsProcessed: 0,
          message: 'Ya hay una sincronización en curso para esta cuenta.',
        };
      }

      const totalPositions =
        spotMatched.length + earnMatched.length + fundingMatched.length;
      const registeredNote =
        newlyRegistered.length > 0
          ? `, ${newlyRegistered.length} moneda(s) nueva(s) registrada(s) automáticamente`
          : '';
      const skippedNote =
        skipped > 0 ? `, ${skipped} omitida(s) por estar desactivadas` : '';
      const earnNote =
        earnMatched.length > 0 ? `, ${earnMatched.length} en Simple Earn` : '';
      const fundingNote =
        fundingMatched.length > 0 ? `, ${fundingMatched.length} en Fondos` : '';
      const message = `${totalPositions} activo(s) sincronizado(s)${earnNote}${fundingNote} (${tradesByAssetId.size} con historial de trades real)${registeredNote}${skippedNote}.`;

      await this.accounts.recordSync(account.id, {
        status: 'completed',
        startedAt,
        recordsProcessed: totalPositions,
        message,
      });
      return { status: 'completed', recordsProcessed: totalPositions, message };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error desconocido al sincronizar.';
      this.logger.error(`Sync de cuenta ${account.id} falló: ${message}`);
      await this.accounts.recordSync(account.id, {
        status: 'failed',
        startedAt,
        recordsProcessed: 0,
        message,
      });
      return { status: 'failed', recordsProcessed: 0, message };
    }
  }
}
