import { Injectable, Logger } from '@nestjs/common';
import { MarketPrismaService } from '../prisma/market-prisma.service';

// Endpoint público de precios de Binance (sin API key). El segundo host es
// el espejo oficial de solo datos de mercado, que sirve de respaldo cuando
// api.binance.com rechaza la región del servidor (HTTP 451/403).
const BINANCE_PRICE_URLS = [
  'https://api.binance.com/api/v3/ticker/price',
  'https://data-api.binance.vision/api/v3/ticker/price',
];

const UNCLASSIFIED_CATEGORY = 'Sin clasificar';

function slugifySymbol(symbol: string): string {
  return symbol
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface TickerDto {
  assetSymbol: string;
  assetName: string;
  price: number;
  changePercent24h: number;
}

export interface AssetSummaryDto {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  logoUrl: string;
  category: string;
  isActive: boolean;
}

export interface AssetRefDto {
  symbol: string;
  name: string;
}

export interface AssetPriceDto {
  symbol: string;
  name: string;
  price: number;
  changePercent24h: number;
}

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(private readonly prisma: MarketPrismaService) {}

  // Símbolos que Binance negocia contra USDT (p.ej. 'BTCUSDT'), para saber
  // qué monedas nuevas tienen precio. Si no se puede consultar, devuelve un
  // Set vacío: las monedas se registran igual, solo quedan sin precio hasta
  // que exista el par.
  private usdtSymbolsCache?: { at: number; symbols: Set<string> };

  private async fetchBinanceUsdtSymbols(): Promise<Set<string>> {
    const cached = this.usdtSymbolsCache;
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
      return cached.symbols;
    }
    for (const url of BINANCE_PRICE_URLS) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = (await res.json()) as Array<{ symbol: string }>;
        const symbols = new Set(
          data.map((d) => d.symbol).filter((sym) => sym.endsWith('USDT')),
        );
        this.usdtSymbolsCache = { at: Date.now(), symbols };
        return symbols;
      } catch {
        // Se intenta con el siguiente host.
      }
    }
    this.logger.warn('No se pudo consultar la lista de pares de Binance');
    return new Set();
  }

  // Binance muestra el dinero que el usuario tiene en Simple Earn (ahorro
  // flexible) como monedas con prefijo "LD": LDBNB es BNB, LDUSDT es USDT.
  // No son monedas reales (no tienen par de trading), así que se
  // reconocen y se devuelven como alias -> moneda real, para sumarlas a
  // su moneda de verdad. Un símbolo que SÍ tiene su propio par contra USDT
  // (p.ej. LDO, el token de Lido) nunca se trata como alias.
  async resolveEarnAliases(symbols: string[]): Promise<Map<string, string>> {
    const candidates = symbols.filter(
      (s) => s.startsWith('LD') && s.length > 2,
    );
    const aliases = new Map<string, string>();
    if (candidates.length === 0) return aliases;

    const pairs = await this.fetchBinanceUsdtSymbols();
    // Sin la lista de pares no se puede distinguir un alias de una moneda
    // real: mejor no tocar nada que fusionar mal.
    if (pairs.size === 0) return aliases;

    for (const symbol of candidates) {
      if (pairs.has(`${symbol}USDT`)) continue;
      const base = symbol.slice(2);
      if (base === 'USDT' || pairs.has(`${base}USDT`)) {
        aliases.set(symbol, base);
      }
    }
    return aliases;
  }

  // Desactiva monedas del catálogo (p.ej. los alias LD que una versión
  // anterior registró por error). No se borran: así no se recrean y no se
  // pierde ninguna referencia existente.
  async deactivateAssets(symbols: string[]): Promise<void> {
    if (symbols.length === 0) return;
    await this.prisma.asset.updateMany({
      where: { symbol: { in: symbols }, isActive: true },
      data: { isActive: false },
    });
  }

  // Registra automáticamente en el catálogo toda moneda que todavía no
  // exista (p.ej. las que aparecen en los balances de una cuenta de
  // Binance). Además deja listos Binance + mercado Spot + USDT, así que
  // funciona aunque el seed inicial nunca se haya corrido (caso típico de
  // una base recién creada en producción). Para cada moneda nueva con par
  // contra USDT crea el trading pair y el mercado de Binance, que es lo que
  // el sync de precios necesita para empezar a cotizarla. Idempotente.
  // Devuelve los símbolos que se crearon en esta llamada.
  async ensureAssets(symbols: string[]): Promise<string[]> {
    const wanted = [
      ...new Set(symbols.map((s) => s.trim().toUpperCase())),
    ].filter((s) => s.length > 0);
    if (wanted.length === 0) return [];

    const toCheck = [...new Set([...wanted, 'USDT'])];
    const existing = await this.prisma.asset.findMany({
      where: { symbol: { in: toCheck } },
      select: { symbol: true },
    });
    const existingSymbols = new Set(existing.map((a) => a.symbol));
    const missing = toCheck.filter((s) => !existingSymbols.has(s));
    if (missing.length === 0) return [];

    const [unclassified, stablecoin] = await Promise.all([
      this.prisma.assetCategorie.upsert({
        where: { name: UNCLASSIFIED_CATEGORY },
        create: {
          name: UNCLASSIFIED_CATEGORY,
          description: 'Monedas registradas automáticamente al sincronizar.',
        },
        update: {},
      }),
      this.prisma.assetCategorie.upsert({
        where: { name: 'Stablecoin' },
        create: {
          name: 'Stablecoin',
          description:
            'Activos diseñados para mantener paridad con una moneda fiat.',
        },
        update: {},
      }),
    ]);

    const binance = await this.prisma.exchange.upsert({
      where: { slug: 'binance' },
      create: {
        name: 'Binance',
        slug: 'binance',
        website: 'https://www.binance.com',
        logoUrl: '',
        country: 'Global',
        isActive: true,
      },
      update: {},
    });
    const spot = await this.prisma.marketType.upsert({
      where: { name: 'Spot' },
      create: {
        name: 'Spot',
        description: 'Compra/venta al precio actual, sin apalancamiento.',
      },
      update: {},
    });

    const usdtPairs = await this.fetchBinanceUsdtSymbols();
    const created: string[] = [];

    // USDT primero: es la moneda de cotización de todos los pares.
    const ordered = [
      ...missing.filter((s) => s === 'USDT'),
      ...missing.filter((s) => s !== 'USDT'),
    ];

    for (const symbol of ordered) {
      try {
        const isUsdt = symbol === 'USDT';
        const asset = await this.prisma.asset.upsert({
          where: { symbol },
          create: {
            symbol,
            name: isUsdt ? 'Tether' : symbol,
            slug: isUsdt ? 'tether' : slugifySymbol(symbol),
            logoUrl: '',
            description: '',
            website: '',
            whitepaper: '',
            isActive: true,
            categoryId: isUsdt ? stablecoin.id : unclassified.id,
          },
          update: {},
        });
        created.push(symbol);

        if (isUsdt || !usdtPairs.has(`${symbol}USDT`)) continue;

        const usdt = await this.prisma.asset.findUnique({
          where: { symbol: 'USDT' },
          select: { id: true },
        });
        if (!usdt) continue;

        const pair = await this.prisma.tradingPair.upsert({
          where: {
            baseAssetId_quoteAssetId: {
              baseAssetId: asset.id,
              quoteAssetId: usdt.id,
            },
          },
          create: {
            baseAssetId: asset.id,
            quoteAssetId: usdt.id,
            symbol: `${symbol}/USDT`,
            isActive: true,
          },
          update: {},
        });
        await this.prisma.exchangeMarket.upsert({
          where: {
            exchangeId_tradingPairId_marketTypeId: {
              exchangeId: binance.id,
              tradingPairId: pair.id,
              marketTypeId: spot.id,
            },
          },
          create: {
            exchangeId: binance.id,
            tradingPairId: pair.id,
            marketTypeId: spot.id,
            exchangeSymbol: `${symbol}USDT`,
            isActive: true,
          },
          update: { isActive: true },
        });
      } catch (err) {
        // Una moneda problemática (p.ej. slug repetido) no debe impedir
        // registrar las demás.
        this.logger.error(`No se pudo registrar la moneda ${symbol}`, err);
      }
    }

    if (created.length > 0) {
      this.logger.log(
        `Monedas registradas automáticamente: ${created.join(', ')}`,
      );
    }
    return created;
  }

  // Devuelve el ticker más reciente de cada trading pair contra USDT en
  // Binance Spot — es el set que hoy consume la pantalla /market del
  // frontend (ver apps/web/src/app/(dashboard)/market/page.tsx). El
  // filtro por `symbols` es opcional (coincide con el contrato ya
  // documentado en api-client.ts: GET /market/tickers?symbols=).
  async getTickers(symbols?: string[]): Promise<TickerDto[]> {
    const markets = await this.prisma.exchangeMarket.findMany({
      where: {
        isActive: true,
        trading: {
          quoteAsset: { symbol: 'USDT' },
          ...(symbols?.length
            ? {
                baseAsset: {
                  symbol: { in: symbols.map((s) => s.toUpperCase()) },
                },
              }
            : {}),
        },
      },
      include: {
        trading: { include: { baseAsset: true } },
        tickers: true,
      },
    });

    return markets
      .filter((m) => m.tickers.length > 0)
      .map((m) => {
        const ticker = m.tickers[0];
        return {
          assetSymbol: m.trading.baseAsset.symbol,
          assetName: m.trading.baseAsset.name,
          price: Number(ticker.last_price),
          changePercent24h: Number(ticker.price_change_percent),
        };
      })
      .sort((a, b) => a.assetSymbol.localeCompare(b.assetSymbol));
  }

  // Catálogo de activos activos, con su categoría — usado por selects de
  // activo en formularios (p.ej. alta manual de transacción en Portfolio)
  // y por cualquier pantalla que necesite el listado completo, no solo
  // los que ya tienen ticker.
  async getAssets(): Promise<AssetSummaryDto[]> {
    const assets = await this.prisma.asset.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { symbol: 'asc' },
    });

    return assets.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      slug: a.slug,
      logoUrl: a.logoUrl,
      category: a.category.name,
      isActive: a.isActive,
    }));
  }

  async getAssetBySymbol(symbol: string) {
    return this.prisma.asset.findUnique({
      where: { symbol: symbol.toUpperCase() },
      include: { category: true },
    });
  }

  // Resuelve un exchange por su slug (p.ej. 'binance') — usado por
  // ExchangeService al conectar una cuenta, ya que ExchangeAccount.exchangeId
  // solo guarda el UUID (sin FK cruzada entre bases, igual que assetId).
  async getExchangeBySlug(slug: string) {
    return this.prisma.exchange.findUnique({ where: { slug } });
  }

  // --- Métodos de uso interno entre módulos (no expuestos por el controller) ---
  // El módulo Portfolio guarda solo el UUID del activo (assetId) — no hay FK
  // cruzada entre bases de datos (ver Resumen_Backend_Plataforma_Inversiones.docx),
  // así que necesita pedirle a este servicio el símbolo/nombre/precio para
  // mostrar posiciones y transacciones de forma legible. Como Market y
  // Portfolio corren en el mismo proceso de Nest (monolito modular, no
  // microservicios de verdad), esto es una llamada de método normal, no HTTP.

  async getAssetsByIds(ids: string[]): Promise<Map<string, AssetRefDto>> {
    if (ids.length === 0) return new Map();
    const assets = await this.prisma.asset.findMany({
      where: { id: { in: ids } },
    });
    return new Map(
      assets.map((a) => [a.id, { symbol: a.symbol, name: a.name }]),
    );
  }

  // Precio actual (contra USDT en Binance Spot) por assetId — usado para
  // calcular currentValue/unrealizedPnl de las posiciones de un portafolio.
  // Si un activo todavía no tiene ticker sincronizado, simplemente no
  // aparece en el Map (el caller decide qué hacer: mostrar sin precio, o
  // caer al avgPrice como aproximación).
  async getPricesByAssetIds(
    ids: string[],
  ): Promise<Map<string, AssetPriceDto>> {
    if (ids.length === 0) return new Map();
    const markets = await this.prisma.exchangeMarket.findMany({
      where: {
        isActive: true,
        trading: { baseAssetId: { in: ids }, quoteAsset: { symbol: 'USDT' } },
      },
      include: { trading: { include: { baseAsset: true } }, tickers: true },
    });

    const map = new Map<string, AssetPriceDto>();
    for (const m of markets) {
      if (m.tickers.length === 0) continue;
      const t = m.tickers[0];
      map.set(m.trading.baseAssetId, {
        symbol: m.trading.baseAsset.symbol,
        name: m.trading.baseAsset.name,
        price: Number(t.last_price),
        changePercent24h: Number(t.price_change_percent),
      });
    }
    return map;
  }
}
