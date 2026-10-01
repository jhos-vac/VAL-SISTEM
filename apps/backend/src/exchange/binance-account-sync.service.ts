import { Injectable, Logger } from '@nestjs/common';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { MarketService, type AssetSummaryDto } from '../market/market.service';
import { BinanceTickerSyncService } from '../market/binance-ticker-sync.service';
import {
  BinanceAccountClientService,
  type BinanceTrade,
} from './binance-account-client.service';
import { decryptSecret } from '../common/security/encryption.util';

// Sufijo de la dirección interna de la wallet de Simple Earn de una cuenta
// (la de Spot es `binance:<id>`, la de Earn `binance:<id>:earn`).
const EARN_ADDRESS_SUFFIX = ':earn';
const FUNDING_ADDRESS_SUFFIX = ':funding';

export interface ExchangeAccountForSync {
  id: string;
  apiKey: string; // cifrado
  apiSecret: string; // cifrado
  isTestnet: boolean;
}

export interface SyncResult {
  status: 'completed' | 'failed';
  recordsProcessed: number;
  message: string;
}

interface CostBasis {
  avgPrice: number;
  realizedProfit: number;
}

// Costo promedio ponderado a partir del historial de trades, mismo
// método que transaction.service.ts usa para el alta manual (ver
// TransactionService.create): cada compra recalcula el promedio, cada
// venta lo deja igual y solo acumula ganancia realizada. Se recorre en
// orden cronológico (BinanceAccountClientService.getMyTrades ya
// devuelve los trades ordenados por tiempo).
//
// Simplificación conocida: si el usuario depositó el activo directo a
// Binance (no lo compró ahí) o lo movió entre cuentas, esos movimientos
// no aparecen en /api/v3/myTrades — el cálculo asume que toda la
// cantidad que se tiene hoy vino de estos trades. Es una aproximación
// mejor que "precio de mercado al momento del sync" (comportamiento
// anterior), pero no es contabilidad exacta.
function computeCostBasisFromTrades(trades: BinanceTrade[]): CostBasis {
  let quantity = 0;
  let avgPrice = 0;
  let realizedProfit = 0;

  for (const t of trades) {
    if (t.isBuyer) {
      const newQuantity = quantity + t.qty;
      avgPrice =
        newQuantity > 0
          ? (quantity * avgPrice + t.qty * t.price) / newQuantity
          : t.price;
      quantity = newQuantity;
    } else {
      const sellQty = Math.min(t.qty, quantity);
      realizedProfit += sellQty * (t.price - avgPrice);
      quantity = Math.max(0, quantity - t.qty);
    }
  }

  return { avgPrice, realizedProfit };
}

// Sincroniza los balances reales de una cuenta de Binance conectada hacia
// la wallet de exchange asociada (ver ExchangeService.connect, que crea
// esa wallet con walletType: 'exchange'). A diferencia de una wallet
// manual — donde el usuario arma el historial a mano, ver
// transaction.service.ts — acá el balance de Binance ES la fuente de
// verdad para la CANTIDAD: cada corrida borra las posiciones/transacciones
// previas de esa wallet y las reconstruye desde el snapshot fresco, así
// nunca queda nada duplicado ni desactualizado. El costo base (avgPrice)
// y la ganancia realizada, en cambio, se calculan del historial de
// trades de Binance cuando existe (ver computeCostBasisFromTrades);
// si un activo no tiene trades (se depositó directo, o es USDT), cae al
// precio de mercado actual como antes.
@Injectable()
export class BinanceAccountSyncService {
  private readonly logger = new Logger(BinanceAccountSyncService.name);

  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly marketService: MarketService,
    private readonly tickerSync: BinanceTickerSyncService,
    private readonly binanceClient: BinanceAccountClientService,
  ) {}

  async syncAccount(account: ExchangeAccountForSync): Promise<SyncResult> {
    const startedAt = new Date();

    try {
      const apiKey = decryptSecret(account.apiKey);
      const apiSecret = decryptSecret(account.apiSecret);
      const snapshot = await this.binanceClient.getAccountSnapshot(
        apiKey,
        apiSecret,
        account.isTestnet,
      );

      const spotWallet = await this.prisma.wallet.findFirst({
        where: {
          exchangeAccountId: account.id,
          NOT: [
            { address: { endsWith: EARN_ADDRESS_SUFFIX } },
            { address: { endsWith: FUNDING_ADDRESS_SUFFIX } },
          ],
        },
      });
      if (!spotWallet) {
        throw new Error(
          'No existe una wallet asociada a esta cuenta de exchange.',
        );
      }

      // Binance reparte el dinero en varios lugares y cada uno se guarda en
      // su propia wallet, igual que en la app de Binance:
      //  - Spot: /api/v3/account.
      //  - Earn: Simple Earn flexible + plazo fijo, desde los endpoints de
      //    Earn. Si no se pueden leer, se cae a las monedas con prefijo
      //    "LD" de Spot (LDBNB es BNB, LDUSDT es USDT), que solo cubren el
      //    flexible.
      //  - Fondos (Funding): billetera de P2P/pagos, que NO aparece en Spot.
      const [earnFromApi, fundingFromApi] = await Promise.all([
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

      // Toda moneda con balance que todavía no esté en el catálogo se
      // registra sola (con su par contra USDT si Binance lo tiene). Si se
      // creó alguna, se traen sus precios ya mismo para que la posición
      // no quede en 0 hasta la próxima corrida periódica del sync de
      // precios.
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
        const out: Array<{ quantity: number; asset: AssetSummaryDto }> = [];
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

      // Historial de trades por activo (para costo base real) — USDT es
      // la moneda de cotización de todos los pares del catálogo, así que
      // no tiene un par "USDTUSDT" contra el cual buscar trades: su
      // costo base es siempre 1:1 por definición. Sin precio = sin par
      // contra USDT, tampoco hay historial que pedir.
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

      const transactionTypes = await this.prisma.transactionType.findMany({
        where: { code: { in: ['buy', 'sell'] } },
      });
      const typeIdByCode = new Map(transactionTypes.map((t) => [t.code, t.id]));

      // Wallets de Earn y Fondos: se crean solo cuando hay saldo ahí. Si ya
      // existían y ahora están vacías, igual se reconstruyen (quedan sin
      // posiciones).
      const baseName = spotWallet.walletName.replace(/ · Spot$/, '');
      const subWalletDefs = [
        {
          suffix: EARN_ADDRESS_SUFFIX,
          label: 'Earn',
          matched: earnMatched,
        },
        {
          suffix: FUNDING_ADDRESS_SUFFIX,
          label: 'Fondos',
          matched: fundingMatched,
        },
      ];
      const subWallets: Array<{
        walletId: string;
        matched: typeof earnMatched;
        suffix: string;
      }> = [];
      for (const def of subWalletDefs) {
        let wallet = await this.prisma.wallet.findFirst({
          where: {
            exchangeAccountId: account.id,
            address: { endsWith: def.suffix },
          },
        });
        if (def.matched.length > 0) {
          if (!spotWallet.walletName.endsWith(' · Spot')) {
            spotWallet.walletName = `${baseName} · Spot`;
            await this.prisma.wallet.update({
              where: { id: spotWallet.id },
              data: { walletName: spotWallet.walletName },
            });
          }
          wallet ??= await this.prisma.wallet.create({
            data: {
              portfolioId: spotWallet.portfolioId,
              exchangeAccountId: account.id,
              walletName: `${baseName} · ${def.label}`,
              walletType: 'exchange',
              address: `${spotWallet.address}${def.suffix}`,
              network: spotWallet.network,
            },
          });
        }
        if (wallet) {
          subWallets.push({
            walletId: wallet.id,
            matched: def.matched,
            suffix: def.suffix,
          });
        }
      }

      const spotSymbols = new Set(spotBalances.keys());
      const earnSymbols = new Set(earnBalances.keys());

      await this.prisma.$transaction(async (tx) => {
        const rebuildWallet = async (
          walletId: string,
          matched: Array<{ quantity: number; asset: AssetSummaryDto }>,
          carriesHistory: (asset: AssetSummaryDto) => boolean,
        ) => {
          const existingPositions = await tx.assetPosition.findMany({
            where: { walletId },
            select: { id: true },
          });
          const positionIds = existingPositions.map((p) => p.id);
          if (positionIds.length > 0) {
            await tx.transaction.deleteMany({
              where: { assetPositionId: { in: positionIds } },
            });
            await tx.assetPosition.deleteMany({ where: { walletId } });
          }

          for (const { quantity, asset } of matched) {
            const marketPrice = prices.get(asset.id)?.price ?? 0;
            const trades = tradesByAssetId.get(asset.id);
            // El costo base (precio promedio) es el mismo para la moneda
            // en cualquier wallet, pero la ganancia realizada y el
            // historial de operaciones se cuentan una sola vez: en la
            // wallet que "lleva" el historial.
            const withHistory = carriesHistory(asset);
            const computed =
              asset.symbol === 'USDT'
                ? { avgPrice: 1, realizedProfit: 0 }
                : trades
                  ? computeCostBasisFromTrades(trades)
                  : { avgPrice: marketPrice, realizedProfit: 0 };
            const costBasis = {
              avgPrice: computed.avgPrice,
              realizedProfit: withHistory ? computed.realizedProfit : 0,
            };

            const position = await tx.assetPosition.create({
              data: {
                walletId,
                assetId: asset.id,
                quantity,
                avgPrice: costBasis.avgPrice,
                realizedProfit: costBasis.realizedProfit,
                unrealizedProfit: 0,
              },
            });

            // Además de la posición, se deja el historial de trades como
            // transacciones individuales (source real, no solo el
            // agregado) — así /transactions también muestra las compras y
            // ventas reales hechas en Binance, no solo el resultado neto.
            // No se guarda el orderId de Binance en exchangeOrderId (esa
            // columna es @db.Uuid y el orderId de Binance es numérico, no
            // un UUID) — queda como referencia en notes en su lugar.
            if (withHistory && trades && trades.length > 0) {
              const rows = trades
                .filter((t) => typeIdByCode.has(t.isBuyer ? 'buy' : 'sell'))
                .map((t) => ({
                  assetPositionId: position.id,
                  transactionTypeId: typeIdByCode.get(
                    t.isBuyer ? 'buy' : 'sell',
                  )!,
                  quantity: t.qty,
                  price: t.price,
                  fee: t.commission,
                  total: t.quoteQty,
                  notes: `Binance order ${t.orderId} (comisión en ${t.commissionAsset})`,
                  executedAt: new Date(t.time),
                }));
              if (rows.length > 0) {
                await tx.transaction.createMany({ data: rows });
              }
            }
          }
        };

        await rebuildWallet(spotWallet.id, spotMatched, () => true);
        for (const sub of subWallets) {
          // Si la moneda solo está en Earn/Fondos (no en Spot), esa wallet
          // lleva su historial y su ganancia realizada, para contarlos una
          // sola vez.
          await rebuildWallet(sub.walletId, sub.matched, (asset) =>
            sub.suffix === EARN_ADDRESS_SUFFIX
              ? !spotSymbols.has(asset.symbol)
              : !spotSymbols.has(asset.symbol) &&
                !earnSymbols.has(asset.symbol),
          );
        }
      });

      const totalPositions =
        spotMatched.length + earnMatched.length + fundingMatched.length;
      const withHistory = tradesByAssetId.size;
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
      const message = `${totalPositions} activo(s) sincronizado(s)${earnNote}${fundingNote} (${withHistory} con historial de trades real)${registeredNote}${skippedNote}.`;

      await this.prisma.syncHistory.create({
        data: {
          exchangeAccountId: account.id,
          status: 'completed',
          startedAt,
          finishedAt: new Date(),
          recordsProcessed: totalPositions,
          message,
        },
      });

      return { status: 'completed', recordsProcessed: totalPositions, message };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error desconocido al sincronizar.';
      this.logger.error(`Sync de cuenta ${account.id} falló: ${message}`);
      await this.prisma.syncHistory.create({
        data: {
          exchangeAccountId: account.id,
          status: 'failed',
          startedAt,
          finishedAt: new Date(),
          recordsProcessed: 0,
          message,
        },
      });
      return { status: 'failed', recordsProcessed: 0, message };
    }
  }
}
