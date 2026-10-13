import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { ExchangeController } from './exchange.controller';
import { ExchangeService } from './exchange.service';
import { BinanceAccountClientService } from './binance-account-client.service';
import { BinanceAccountSyncService } from './binance-account-sync.service';

@Module({
  // Portfolio es el dueño de la base donde viven las cuentas, wallets y
  // posiciones: Exchange las escribe solo a través de su API pública.
  imports: [MarketModule, PortfolioModule],
  controllers: [ExchangeController],
  providers: [
    ExchangeService,
    BinanceAccountClientService,
    BinanceAccountSyncService,
  ],
  exports: [BinanceAccountSyncService],
})
export class ExchangeModule {}
