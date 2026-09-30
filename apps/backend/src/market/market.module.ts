import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { BinanceTickerSyncService } from './binance-ticker-sync.service';

@Module({
  controllers: [MarketController],
  providers: [MarketService, BinanceTickerSyncService],
  exports: [MarketService, BinanceTickerSyncService],
})
export class MarketModule {}
