import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { PortfolioPrismaModule } from '../prisma/prisma.module';
import { AccountModule } from '../account/account.module';
import { AlertsModule } from '../alerts/alerts.module';
import { JobLeaseService } from './job-lease.service';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    MarketModule,
    ExchangeModule,
    PortfolioModule,
    PortfolioPrismaModule,
    AccountModule,
    AlertsModule,
  ],
  providers: [JobLeaseService, JobsService],
  exports: [JobLeaseService, JobsService],
})
export class JobsModule {}
