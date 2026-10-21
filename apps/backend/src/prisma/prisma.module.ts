import { Module } from '@nestjs/common';
import { UserPrismaService } from './user-prisma.service';
import { MarketPrismaService } from './market-prisma.service';
import { PortfolioPrismaService } from './portfolio-prisma.service';
import { AutomationPrismaService } from './automation-prisma.service';

// Un módulo por base de datos, NO global: cada dominio importa solo el de
// su base. Así un módulo no puede escribir en las tablas de otro dominio
// (la inyección falla al arrancar) y tiene que usar su API pública. La
// regla de lint de eslint.config.mjs lo refuerza a nivel de imports.
// Cada cliente es un singleton: importarlo desde varios módulos comparte
// el mismo pool de conexiones.

// Identity: auth, users, devices (y el AuditLogInterceptor global).
@Module({
  providers: [UserPrismaService],
  exports: [UserPrismaService],
})
export class UserPrismaModule {}

// Market: catálogo de activos, pares y precios.
@Module({
  providers: [MarketPrismaService],
  exports: [MarketPrismaService],
})
export class MarketPrismaModule {}

// Portfolio: portafolios, wallets, posiciones, transacciones, cuentas de
// exchange y su historial de sync.
@Module({
  providers: [PortfolioPrismaService],
  exports: [PortfolioPrismaService],
})
export class PortfolioPrismaModule {}

// Automation: reglas de aviso y notificaciones (módulo alerts).
@Module({
  providers: [AutomationPrismaService],
  exports: [AutomationPrismaService],
})
export class AutomationPrismaModule {}
