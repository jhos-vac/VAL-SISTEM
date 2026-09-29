import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ExchangeService } from './exchange.service';
import { ConnectExchangeAccountDto } from './dto/connect-exchange-account.dto';

// Todos los endpoints requieren sesión (sin @Public()) — cada método del
// service filtra por userId y devuelve 404 (no 403) si la cuenta no es
// del usuario, mismo patrón que Portfolio.
@Controller('exchange-accounts')
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Post()
  connect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConnectExchangeAccountDto,
  ) {
    return this.exchangeService.connect(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.exchangeService.list(user.id);
  }

  @Post(':id/sync')
  sync(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exchangeService.triggerSync(user.id, id);
  }

  @Delete(':id')
  async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.exchangeService.disconnect(user.id, id);
    return { success: true };
  }
}
