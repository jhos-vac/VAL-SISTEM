import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PortfolioService } from './portfolio.service';
import { WalletService } from './wallet.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';

// Todos los endpoints requieren sesión (no hay @Public()) — cada método
// del service filtra por userId, así que un usuario nunca puede leer ni
// tocar portafolios/wallets de otro (404, no 403, para no filtrar si el
// id existe).
@Controller('portfolios')
export class PortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly walletService: WalletService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfolioService.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.portfolioService.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.portfolioService.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioDto,
  ) {
    return this.portfolioService.update(user.id, id, dto);
  }

  @Get(':id/summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.portfolioService.getSummary(user.id, id);
  }

  @Get(':id/allocation')
  allocation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.portfolioService.getAllocation(user.id, id);
  }

  @Get(':id/performance')
  performance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    return this.portfolioService.getPerformance(
      user.id,
      id,
      days ? Number(days) : undefined,
    );
  }

  @Post(':id/wallets')
  createWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') portfolioId: string,
    @Body() dto: CreateWalletDto,
  ) {
    return this.walletService.create(user.id, portfolioId, dto);
  }

  @Get(':id/wallets')
  listWallets(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') portfolioId: string,
  ) {
    return this.walletService.list(user.id, portfolioId);
  }

  @Patch(':id/wallets/:walletId')
  updateWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') portfolioId: string,
    @Param('walletId') walletId: string,
    @Body() dto: UpdateWalletDto,
  ) {
    return this.walletService.update(user.id, portfolioId, walletId, dto);
  }

  @Delete(':id/wallets/:walletId')
  deactivateWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') portfolioId: string,
    @Param('walletId') walletId: string,
  ) {
    return this.walletService.deactivate(user.id, portfolioId, walletId);
  }
}
