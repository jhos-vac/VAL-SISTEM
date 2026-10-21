import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { AlertsModule } from '../alerts/alerts.module';
import { AccountController } from './account.controller';
import { AccountDeletionService } from './account-deletion.service';

// Casos de uso que cruzan dominios (Identity + Portfolio) sin que esos
// dominios dependan entre sí: este módulo los coordina por sus APIs.
@Module({
  imports: [UsersModule, PortfolioModule, AlertsModule],
  controllers: [AccountController],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountModule {}
