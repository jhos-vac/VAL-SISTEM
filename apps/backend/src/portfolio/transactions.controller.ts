import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionService.create(user.id, dto);
  }

  @Get()
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('portfolioId') portfolioId?: string,
    @Query('assetSymbol') assetSymbol?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!portfolioId) {
      throw new BadRequestException('Falta el query param portfolioId');
    }
    return this.transactionService.getHistory(user.id, portfolioId, {
      assetSymbol,
      type,
      from,
      to,
    });
  }
}
