import { Injectable } from '@nestjs/common';
import { MarketPrismaService } from '../prisma/market-prisma.service';

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
  constructor(private readonly prisma: MarketPrismaService) {}

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
