import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { MarketPrismaService } from '../prisma/market-prisma.service';

// El segundo host es el espejo oficial de solo datos de mercado: se usa
// si api.binance.com rechaza la región del servidor (HTTP 451/403).
const BINANCE_TICKER_24H_URLS = [
  'https://api.binance.com/api/v3/ticker/24hr',
  'https://data-api.binance.vision/api/v3/ticker/24hr',
];
// Binance acepta como máximo 100 símbolos por request en este endpoint.
const SYMBOLS_PER_REQUEST = 100;
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 min

interface BinanceTicker24h {
  symbol: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  priceChange: string;
  priceChangePercent: string;
  openTime: number;
  closeTime: number;
}

// Sincroniza precios públicos de Binance (endpoint sin autenticación, no
// requiere API key) hacia MarketTicker. Es el "job de sincronización
// pública de tickers" de la Bitácora — corre cada 5 minutos vía
// setInterval (arrancado en onModuleInit) y también se puede disparar a
// mano con POST /market/sync/tickers.
//
// Se usa setInterval nativo en vez de @nestjs/schedule/cron a propósito:
// ese paquete arrastra varias dependencias opcionales pesadas
// (microservices, grpc, luxon, etc.) que hicieron `npm install` colgarse
// repetidamente por lentitud del registry al resolver ese árbol. Un
// intervalo simple cubre exactamente lo que pide la Bitácora sin esa
// fricción; si más adelante se necesitan cron expressions más complejas,
// se puede reintentar instalar @nestjs/schedule por separado.
//
// Importante: esto NO es el sync de cuentas de exchange del usuario (eso
// vive en el dominio Automation/Sync con API keys cifradas — ver
// Resumen_Backend_Plataforma_Inversiones.docx §7). Este servicio solo lee
// precios públicos, iguales para todos los usuarios.
@Injectable()
export class BinanceTickerSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceTickerSyncService.name);
  private syncing = false;
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: MarketPrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.syncAll();
    }, SYNC_INTERVAL_MS);
    // No bloquear el shutdown del proceso solo por este timer.
    this.timer.unref?.();
    // Primera corrida al arrancar, sin esperar los 5 min.
    void this.syncAll();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // Idempotente: cada corrida hace upsert por exchangeMarketId (unique en
  // MarketTicker), nunca inserta duplicados sin importar cuántas veces se
  // dispare ni si se solapan corridas (el flag `syncing` evita eso último).
  async syncAll(): Promise<{ synced: number; skipped: number }> {
    if (this.syncing) {
      this.logger.warn('Sync ya en curso, se omite esta corrida');
      return { synced: 0, skipped: 0 };
    }
    this.syncing = true;

    try {
      const markets = await this.prisma.exchangeMarket.findMany({
        where: { isActive: true, exchages: { slug: 'binance' } },
      });

      if (markets.length === 0) {
        this.logger.warn(
          'No hay exchange markets activos para Binance — corré el seed (npm run db:seed:market) primero',
        );
        return { synced: 0, skipped: 0 };
      }

      const bySymbol = new Map(markets.map((m) => [m.exchangeSymbol, m]));
      const symbolList = [...bySymbol.keys()];
      const tickers: BinanceTicker24h[] = [];
      for (let i = 0; i < symbolList.length; i += SYMBOLS_PER_REQUEST) {
        const chunk = symbolList.slice(i, i + SYMBOLS_PER_REQUEST);
        const symbolsParam = encodeURIComponent(JSON.stringify(chunk));
        let ok = false;
        for (const baseUrl of BINANCE_TICKER_24H_URLS) {
          const res = await fetch(`${baseUrl}?symbols=${symbolsParam}`);
          if (res.ok) {
            tickers.push(...((await res.json()) as BinanceTicker24h[]));
            ok = true;
            break;
          }
          this.logger.error(
            `Binance respondió ${res.status} al pedir tickers públicos (${baseUrl})`,
          );
        }
        if (!ok) return { synced: 0, skipped: bySymbol.size };
      }
      let synced = 0;

      for (const t of tickers) {
        const market = bySymbol.get(t.symbol);
        if (!market) continue;

        await this.prisma.marketTicker.upsert({
          where: { exchangeMarketId: market.id },
          create: {
            exchangeMarketId: market.id,
            last_price: t.lastPrice,
            bid: t.bidPrice,
            ask: t.askPrice,
            high_24h: t.highPrice,
            low_24h: t.lowPrice,
            volume_base: t.volume,
            volume_quote: t.quoteVolume,
            price_change: t.priceChange,
            price_change_percent: t.priceChangePercent,
            open_time: new Date(t.openTime),
            close_time: new Date(t.closeTime),
            updated_at: new Date(),
          },
          update: {
            last_price: t.lastPrice,
            bid: t.bidPrice,
            ask: t.askPrice,
            high_24h: t.highPrice,
            low_24h: t.lowPrice,
            volume_base: t.volume,
            volume_quote: t.quoteVolume,
            price_change: t.priceChange,
            price_change_percent: t.priceChangePercent,
            open_time: new Date(t.openTime),
            close_time: new Date(t.closeTime),
            updated_at: new Date(),
          },
        });
        synced++;
      }

      this.logger.log(`Tickers sincronizados: ${synced}/${bySymbol.size}`);
      return { synced, skipped: bySymbol.size - synced };
    } catch (err) {
      this.logger.error('Fallo al sincronizar tickers de Binance', err);
      return { synced: 0, skipped: 0 };
    } finally {
      this.syncing = false;
    }
  }
}
