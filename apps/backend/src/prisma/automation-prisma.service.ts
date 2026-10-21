import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/automation-cli/client';

// Cliente Prisma del dominio Automation (reglas de aviso y notificaciones).
@Injectable()
export class AutomationPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AutomationPrismaService.name);

  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_AUTOMATION');
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log(
      'Conectado a la base de datos Automation (DATABASE_AUTOMATION)',
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
