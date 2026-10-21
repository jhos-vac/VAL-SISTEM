import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserPrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MarketModule } from './market/market.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { ExchangeModule } from './exchange/exchange.module';
import { UsersModule } from './users/users.module';
import { DevicesModule } from './devices/devices.module';
import { JobsModule } from './jobs/jobs.module';
import { AccountModule } from './account/account.module';
import { AdminModule } from './admin/admin.module';
import { AlertsModule } from './alerts/alerts.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Para el AuditLogInterceptor global (escribe en la base Identity).
    UserPrismaModule,
    AuthModule,
    MarketModule,
    PortfolioModule,
    ExchangeModule,
    UsersModule,
    DevicesModule,
    AccountModule,
    JobsModule,
    AdminModule,
    AlertsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Orden importa: JwtAuthGuard resuelve req.user primero, RolesGuard lo
    // usa después. Todo endpoint requiere auth salvo @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
