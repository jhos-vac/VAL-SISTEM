import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { PortfolioController } from './portfolio.controller';
import { PositionsController } from './positions.controller';
import { TransactionsController } from './transactions.controller';
import { PortfolioService } from './portfolio.service';
import { WalletService } from './wallet.service';
import { TransactionService } from './transaction.service';
import { PortfolioSnapshotService } from './portfolio-snapshot.service';
import { CapitalAssetService } from './capital-asset.service';
import { CapitalAssetsController } from './capital-assets.controller';

@Module({
  // MarketModule exporta MarketService — Portfolio lo usa para enriquecer
  // posiciones/transacciones con símbolo/nombre/precio (ver
  // portfolio.service.ts y transaction.service.ts).
  imports: [MarketModule],
  controllers: [
    PortfolioController,
    PositionsController,
    TransactionsController,
    CapitalAssetsController,
  ],
  providers: [
    PortfolioService,
    WalletService,
    TransactionService,
    PortfolioSnapshotService,
    CapitalAssetService,
  ],
  exports: [PortfolioService],
})
export class PortfolioModule {}
