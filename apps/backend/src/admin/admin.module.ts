import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { MarketModule } from '../market/market.module';
import { JobsModule } from '../jobs/jobs.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// Panel de administración (solo rol admin). Coordina dominios por sus APIs.
@Module({
  imports: [UsersModule, PortfolioModule, MarketModule, JobsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
