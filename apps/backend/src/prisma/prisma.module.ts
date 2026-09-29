import { Global, Module } from '@nestjs/common';
import { UserPrismaService } from './user-prisma.service';
import { MarketPrismaService } from './market-prisma.service';
import { PortfolioPrismaService } from './portfolio-prisma.service';

// Global para no tener que re-importarlo en cada feature module. A medida
// que se construya Automation, su PrismaService respectivo se agrega acá
// siguiendo el mismo patrón que UserPrismaService.
@Global()
@Module({
  providers: [UserPrismaService, MarketPrismaService, PortfolioPrismaService],
  exports: [UserPrismaService, MarketPrismaService, PortfolioPrismaService],
})
export class PrismaModule {}
