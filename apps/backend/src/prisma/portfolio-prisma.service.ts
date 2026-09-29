import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/portfolio-cli/client';

// Cliente Prisma del dominio Portfolio (portafolios, wallets, posiciones,
// transacciones, transfers, snapshots). Mismo patrón que
// UserPrismaService/MarketPrismaService.
@Injectable()
export class PortfolioPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PortfolioPrismaService.name);

  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_PORTFOLIO');
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log(
      'Conectado a la base de datos Portfolio (DATABASE_PORTFOLIO)',
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
