import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { WatchlistService } from './watchlist.service';

export class AddWatchlistDto {
  @IsString()
  @MaxLength(20)
  assetSymbol: string;
}

@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlist: WatchlistService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.watchlist.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddWatchlistDto) {
    return this.watchlist.add(user.id, dto.assetSymbol.toUpperCase());
  }

  @Delete(':symbol')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('symbol') symbol: string,
  ) {
    return this.watchlist.remove(user.id, symbol.toUpperCase());
  }
}
