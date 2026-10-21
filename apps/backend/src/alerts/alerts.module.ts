import { Module } from '@nestjs/common';
import { AutomationPrismaModule } from '../prisma/prisma.module';
import { MarketModule } from '../market/market.module';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { DevicesModule } from '../devices/devices.module';
import { UsersModule } from '../users/users.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsEvaluatorService } from './alerts-evaluator.service';
import { PushService } from './push.service';

// Avisos: reglas del usuario, centro de notificaciones y push. Dueño de la
// base Automation; usa Market, Portfolio, Devices y Users por su API.
@Module({
  imports: [
    AutomationPrismaModule,
    MarketModule,
    PortfolioModule,
    DevicesModule,
    UsersModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsEvaluatorService, PushService],
  exports: [AlertsService, AlertsEvaluatorService],
})
export class AlertsModule {}
