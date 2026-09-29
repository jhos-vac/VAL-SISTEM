import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/market-cli/client';

// Cliente Prisma del dominio Market (activos, categorías, exchanges,
// trading pairs, tickers). Misma estructura que UserPrismaService — ver
// ese archivo para el razonamiento del patrón.
@Injectable()
export class MarketPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MarketPrismaService.name);

  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_MARKET');
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conectado a la base de datos Market (DATABASE_MARKET)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
