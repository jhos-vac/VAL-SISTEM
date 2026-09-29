import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { ExchangeController } from './exchange.controller';
import { ExchangeService } from './exchange.service';
import { BinanceAccountClientService } from './binance-account-client.service';
import { BinanceAccountSyncService } from './binance-account-sync.service';
import { BinanceAccountPeriodicSyncService } from './binance-account-periodic-sync.service';

@Module({
  imports: [MarketModule],
  controllers: [ExchangeController],
  providers: [
    ExchangeService,
    BinanceAccountClientService,
    BinanceAccountSyncService,
    BinanceAccountPeriodicSyncService,
  ],
})
export class ExchangeModule {}
