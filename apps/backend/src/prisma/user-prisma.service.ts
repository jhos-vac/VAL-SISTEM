import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/user-cli/client';

// Cliente Prisma del dominio Identity (users, roles, permissions, devices,
// refresh tokens, settings). Cada dominio tiene su propia base de datos y
// su propio cliente generado (ver prisma/prisma-*-database) — este
// servicio es el patrón a replicar para Market/Portfolio/Automation
// cuando esos módulos se construyan.
@Injectable()
export class UserPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(UserPrismaService.name);

  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_USER');
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conectado a la base de datos Identity (DATABASE_USER)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
