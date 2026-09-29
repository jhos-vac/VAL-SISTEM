import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MarketService } from './market.service';
import { BinanceTickerSyncService } from './binance-ticker-sync.service';

@Controller('market')
export class MarketController {
  constructor(
    private readonly marketService: MarketService,
    private readonly syncService: BinanceTickerSyncService,
  ) {}

  // Precios públicos — igual que en Binance, no dependen del usuario, así
  // que no requieren sesión. `symbols` opcional, coma-separado (BTC,ETH).
  @Public()
  @Get('tickers')
  getTickers(@Query('symbols') symbols?: string) {
    const list = symbols
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.marketService.getTickers(list);
  }

  @Public()
  @Get('assets')
  getAssets() {
    return this.marketService.getAssets();
  }

  @Public()
  @Get('assets/:symbol')
  async getAsset(@Param('symbol') symbol: string) {
    const asset = await this.marketService.getAssetBySymbol(symbol);
    if (!asset) {
      throw new NotFoundException(`Activo ${symbol} no encontrado`);
    }
    return asset;
  }

  // Disparo manual del sync (además del corrido automático cada 5 min) —
  // útil para pruebas sin esperar. Restringido a admin (permiso
  // "market:sync-tickers" sembrado por npm run db:seed:user) ahora que
  // los roles se resuelven de verdad en el JWT (ver auth.service.ts).
  @Roles('admin')
  @Post('sync/tickers')
  async syncTickers() {
    const result = await this.syncService.syncAll();
    return { ...result, syncedAt: new Date().toISOString() };
  }
}
