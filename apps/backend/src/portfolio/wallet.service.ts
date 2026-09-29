import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';
import { PortfolioService } from './portfolio.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';

export interface WalletDto {
  id: string;
  portfolioId: string;
  walletName: string;
  walletType: string;
  address: string;
  network: string;
  isActive: boolean;
}

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PortfolioPrismaService,
    private readonly portfolioService: PortfolioService,
  ) {}

  private toDto(w: {
    id: string;
    portfolioId: string;
    walletName: string;
    walletType: string;
    address: string;
    network: string;
    isActive: boolean;
  }): WalletDto {
    return {
      id: w.id,
      portfolioId: w.portfolioId,
      walletName: w.walletName,
      walletType: w.walletType,
      address: w.address,
      network: w.network,
      isActive: w.isActive,
    };
  }

  private async findOwnedOrThrow(
    userId: string,
    portfolioId: string,
    walletId: string,
  ) {
    await this.portfolioService.findOwnedOrThrow(userId, portfolioId);
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, portfolioId },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet no encontrada');
    }
    return wallet;
  }

  async create(
    userId: string,
    portfolioId: string,
    dto: CreateWalletDto,
  ): Promise<WalletDto> {
    await this.portfolioService.findOwnedOrThrow(userId, portfolioId);

    // `address` es única en todo el dominio Portfolio (columna @unique) —
    // para wallets sin dirección on-chain real (manuales, o de un
    // exchange que se trackea sin blockchain de por medio) se genera un
    // placeholder único en vez de dejarla vacía.
    const address = dto.address?.trim() || `manual:${randomUUID()}`;

    const wallet = await this.prisma.wallet.create({
      data: {
        portfolioId,
        walletName: dto.walletName,
        walletType: dto.walletType,
        address,
        network: dto.network?.trim() || 'N/A',
      },
    });

    return this.toDto(wallet);
  }

  async list(
    userId: string,
    portfolioId: string,
    includeInactive = false,
  ): Promise<WalletDto[]> {
    await this.portfolioService.findOwnedOrThrow(userId, portfolioId);
    const wallets = await this.prisma.wallet.findMany({
      where: { portfolioId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { createdAt: 'asc' },
    });
    return wallets.map((w) => this.toDto(w));
  }

  async update(
    userId: string,
    portfolioId: string,
    walletId: string,
    dto: UpdateWalletDto,
  ): Promise<WalletDto> {
    await this.findOwnedOrThrow(userId, portfolioId, walletId);
    const wallet = await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        ...(dto.walletName !== undefined ? { walletName: dto.walletName } : {}),
        ...(dto.walletType !== undefined ? { walletType: dto.walletType } : {}),
        ...(dto.network !== undefined ? { network: dto.network } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedAt: new Date(),
      },
    });
    return this.toDto(wallet);
  }

  // "Borrar" una wallet la desactiva en vez de eliminarla de verdad —
  // puede tener posiciones/transacciones asociadas y perderlas de un
  // DELETE real sería destructivo sin aviso. isActive: false la saca de
  // los cálculos de posiciones/summary (ver portfolio.service.ts) y de
  // los listados por defecto.
  async deactivate(
    userId: string,
    portfolioId: string,
    walletId: string,
  ): Promise<WalletDto> {
    await this.findOwnedOrThrow(userId, portfolioId, walletId);
    const wallet = await this.prisma.wallet.update({
      where: { id: walletId },
      data: { isActive: false, updatedAt: new Date() },
    });
    return this.toDto(wallet);
  }
}
