import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { PortfolioController } from './portfolio.controller';
import { PositionsController } from './positions.controller';
import { TransactionsController } from './transactions.controller';
import { PortfolioService } from './portfolio.service';
import { WalletService } from './wallet.service';
import { TransactionService } from './transaction.service';
import { PortfolioSnapshotService } from './portfolio-snapshot.service';

@Module({
  // MarketModule exporta MarketService — Portfolio lo usa para enriquecer
  // posiciones/transacciones con símbolo/nombre/precio (ver
  // portfolio.service.ts y transaction.service.ts).
  imports: [MarketModule],
  controllers: [
    PortfolioController,
    PositionsController,
    TransactionsController,
  ],
  providers: [
    PortfolioService,
    WalletService,
    TransactionService,
    PortfolioSnapshotService,
  ],
  exports: [PortfolioService],
})
export class PortfolioModule {}
