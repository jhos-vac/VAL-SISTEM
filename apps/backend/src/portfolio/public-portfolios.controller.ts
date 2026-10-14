import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PublicPortfoliosService } from './public-portfolios.service';
import {
  CopyPortfolioDto,
  SetPublicationDto,
} from './dto/public-portfolio.dto';

// Requiere sesión (no es @Public()): el ranking es para usuarios de la app.
@Controller()
export class PublicPortfoliosController {
  constructor(private readonly publicPortfolios: PublicPortfoliosService) {}

  @Patch('portfolios/:id/publication')
  setPublication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetPublicationDto,
  ) {
    return this.publicPortfolios.setPublication(user.id, id, dto);
  }

  @Get('public-portfolios')
  ranking() {
    return this.publicPortfolios.ranking();
  }

  @Get('public-portfolios/:id')
  detail(@Param('id') id: string) {
    return this.publicPortfolios.detail(id);
  }

  @Post('public-portfolios/:id/copy')
  copy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CopyPortfolioDto,
  ) {
    return this.publicPortfolios.copy(user.id, id, dto);
  }
}
