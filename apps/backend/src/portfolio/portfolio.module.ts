import { PortfolioAdminService } from './portfolio-admin.service';
import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { PortfolioPrismaModule } from '../prisma/prisma.module';
import { PortfolioController } from './portfolio.controller';
import { PositionsController } from './positions.controller';
import { TransactionsController } from './transactions.controller';
import { PortfolioService } from './portfolio.service';
import { WalletService } from './wallet.service';
import { TransactionService } from './transaction.service';
import { PortfolioSnapshotService } from './portfolio-snapshot.service';
import { CapitalAssetService } from './capital-asset.service';
import { CapitalAssetsController } from './capital-assets.controller';
import { ExchangeAccountStore } from './exchange-account.store';
import { PositionLedgerService } from './position-ledger.service';
import { UserDataPurgeService } from './user-data-purge.service';
import { LotsService } from './lots.service';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { StrategyService } from './strategy.service';
import { StrategyController } from './strategy.controller';
import { PublicPortfoliosService } from './public-portfolios.service';
import { PublicPortfoliosController } from './public-portfolios.controller';

@Module({
  // MarketModule exporta MarketService — Portfolio lo usa para enriquecer
  // posiciones/transacciones con símbolo/nombre/precio (ver
  // portfolio.service.ts y transaction.service.ts).
  imports: [MarketModule, PortfolioPrismaModule],
  controllers: [
    PortfolioController,
    PositionsController,
    TransactionsController,
    CapitalAssetsController,
    GoalsController,
    StrategyController,
    PublicPortfoliosController,
  ],
  providers: [
    PortfolioService,
    WalletService,
    TransactionService,
    PortfolioSnapshotService,
    CapitalAssetService,
    ExchangeAccountStore,
    PositionLedgerService,
    UserDataPurgeService,
    LotsService,
    GoalsService,
    StrategyService,
    PublicPortfoliosService,
    PortfolioAdminService,
  ],
  // API pública del módulo: lo que otros módulos (Exchange, jobs) pueden
  // usar. Nadie más escribe en la base Portfolio.
  exports: [
    PortfolioService,
    PortfolioSnapshotService,
    ExchangeAccountStore,
    PositionLedgerService,
    UserDataPurgeService,
    PortfolioAdminService,
  ],
})
export class PortfolioModule {}
