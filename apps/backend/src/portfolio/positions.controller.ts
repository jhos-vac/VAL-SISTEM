import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PortfolioService } from './portfolio.service';

@Controller('positions')
export class PositionsController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('portfolioId') portfolioId?: string,
  ) {
    if (!portfolioId) {
      throw new BadRequestException('Falta el query param portfolioId');
    }
    return this.portfolioService.getPositions(user.id, portfolioId);
  }
}
